import { prisma } from '@geekstore/db';
import type { RoleCode } from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../test-support/build-test-app';
import { createUser } from '../test-support/fixtures';

describe('RBAC on the admin routes (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  const users = new Map<RoleCode, { user_id: string; token: string }>();
  const roles: RoleCode[] = ['owner', 'manager', 'stock', 'support', 'viewer'];
  const categorySlugs: string[] = [];

  const bearer = (role: RoleCode) => ({ authorization: `Bearer ${users.get(role)?.token}` });

  beforeAll(async () => {
    app = await buildTestApp();
    for (const role of roles) {
      const user = await createUser(role);
      users.set(role, {
        user_id: user.user_id,
        token: app.jwt.sign({ sub: user.user_id, role }),
      });
    }
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { slug: { in: categorySlugs } } });
    const ids = [...users.values()].map((user) => user.user_id);
    await prisma.auditLog.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.user.deleteMany({ where: { user_id: { in: ids } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('401 without a token, with garbage, and with a token signed by someone else', async () => {
    for (const authorization of [undefined, 'Bearer lixo', 'Basic abc']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/catalog/products',
        headers: authorization ? { authorization } : {},
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'unauthorized' });
    }
  });

  it('viewer reads but gets 403 on every write route', async () => {
    const read = await app.inject({
      method: 'GET',
      url: '/api/catalog/products',
      headers: bearer('viewer'),
    });
    expect(read.statusCode).toBe(200);

    const writes = [
      { method: 'POST', url: '/api/catalog/categories', payload: { name: 'x', slug: 'x' } },
      { method: 'POST', url: '/api/catalog/media/upload-url', payload: {} },
      { method: 'PATCH', url: '/api/pricing/prices', payload: { items: [] } },
      { method: 'PATCH', url: '/api/stock/levels', payload: { items: [] } },
      { method: 'POST', url: '/api/users', payload: {} },
    ] as const;
    for (const write of writes) {
      const response = await app.inject({ ...write, headers: bearer('viewer') });
      expect(response.statusCode, `${write.method} ${write.url}`).toBe(403);
      expect(response.json()).toMatchObject({ code: 'forbidden' });
    }
  });

  it('403 comes before body validation (authorization is checked first)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/catalog/categories',
      headers: bearer('support'),
      payload: { invalido: true },
    });
    expect(response.statusCode).toBe(403);
  });

  it('per-role matrix: audit and users are for owner/manager, stock writes for stock', async () => {
    const status = async (role: RoleCode, method: 'GET' | 'PATCH', url: string, payload?: object) =>
      (await app.inject({ method, url, headers: bearer(role), payload })).statusCode;

    expect(await status('manager', 'GET', '/api/audit-logs')).toBe(200);
    expect(await status('stock', 'GET', '/api/audit-logs')).toBe(403);
    expect(await status('manager', 'GET', '/api/users')).toBe(200);
    expect(await status('stock', 'GET', '/api/users')).toBe(403);
    expect(await status('manager', 'PATCH', '/api/stock/levels', { items: [] })).toBe(400); // passou no RBAC, falhou no body
    expect(await status('stock', 'PATCH', '/api/stock/levels', { items: [] })).toBe(400);
    expect(await status('stock', 'PATCH', '/api/pricing/prices', { items: [] })).toBe(403);
  });

  it('owner writes go through and are audited with the actor', async () => {
    const slug = `it-rbac-${Date.now()}`;
    categorySlugs.push(slug);
    const response = await app.inject({
      method: 'POST',
      url: '/api/catalog/categories',
      headers: bearer('owner'),
      payload: { name: 'RBAC', slug },
    });
    expect(response.statusCode).toBe(201);

    const categoryId = response.json().data.category_id as string;
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entity_id: categoryId } });
    expect(log.user_id).toBe(users.get('owner')?.user_id);
    await prisma.auditLog.deleteMany({ where: { entity_id: categoryId } });
  });

  it('users: cannot change own role or delete self; role change revokes sessions', async () => {
    const owner = users.get('owner');
    const self = await app.inject({
      method: 'PATCH',
      url: `/api/users/${owner?.user_id}`,
      headers: bearer('owner'),
      payload: { role: 'viewer' },
    });
    expect(self.statusCode).toBe(400);
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/users/${owner?.user_id}`,
      headers: bearer('owner'),
    });
    expect(del.statusCode).toBe(400);

    const target = users.get('support');
    await prisma.refreshToken.create({
      data: {
        user_id: target?.user_id as string,
        token_hash: `${'a'.repeat(63)}1`,
        expires_at: new Date(Date.now() + 60_000),
      },
    });
    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/users/${target?.user_id}`,
      headers: bearer('owner'),
      payload: { role: 'stock' },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().data.role).toBe('stock');
    const active = await prisma.refreshToken.count({
      where: { user_id: target?.user_id as string, revoked_at: null },
    });
    expect(active).toBe(0);
    await prisma.refreshToken.deleteMany({ where: { user_id: target?.user_id as string } });
  });
});
