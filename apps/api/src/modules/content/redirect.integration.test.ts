import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { createUser } from '../../test-support/fixtures';
import { wouldLoop } from './redirect.service';

describe('wouldLoop', () => {
  const map = new Map([
    ['/a', '/b/'],
    ['/b', '/c/'],
  ]);

  it('detects a loop through the existing chain', () => {
    expect(wouldLoop('/c', '/a/', map)).toBe(true);
    expect(wouldLoop('/b', '/a/', map)).toBe(true);
  });

  it('accepts a chain that ends', () => {
    expect(wouldLoop('/x', '/a/', map)).toBe(false);
    expect(wouldLoop('/x', '/z/', map)).toBe(false);
  });

  it('treats a chain that is too long as a loop', () => {
    const long = new Map(Array.from({ length: 20 }, (_, i) => [`/p${i}`, `/p${i + 1}/`] as const));
    expect(wouldLoop('/x', '/p0/', long)).toBe(true);
  });
});

describe('redirects (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let owner: string;
  let viewer: string;
  let stock: string;
  let userIds: string[] = [];
  const run = randomUUID().slice(0, 6);
  const path = (suffix: string) => `/it-${run}/${suffix}`;

  const admin = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: object
  ) =>
    app.inject({
      method,
      url: `/api/content/redirects${url}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const create = async (from: string, to: string) =>
    (await admin('POST', '', owner, { from_path: from, to_path: to })).json().data as {
      redirect_id: string;
    };

  beforeAll(async () => {
    app = await buildTestApp();
    const [o, v, s] = await Promise.all([
      createUser('owner', `ro${run}`),
      createUser('viewer', `rv${run}`),
      createUser('stock', `rs${run}`),
    ]);
    userIds = [o.user_id, v.user_id, s.user_id];
    owner = app.jwt.sign({ sub: o.user_id, role: 'owner' });
    viewer = app.jwt.sign({ sub: v.user_id, role: 'viewer' });
    stock = app.jwt.sign({ sub: s.user_id, role: 'stock' });
  });

  afterAll(async () => {
    await prisma.redirect.deleteMany({ where: { from_path: { startsWith: `/it-${run}` } } });
    await prisma.auditLog.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.user.deleteMany({ where: { user_id: { in: userIds } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a redirect with both addresses normalized and appears in the public map', async () => {
    const response = await admin('POST', '', owner, {
      from_path: `https://www.lojageekstore.com${path('Antiga')}/?utm=1`,
      to_path: `${path('nova')}`,
      note: 'teste',
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      from_path: path('antiga'),
      to_path: `${path('nova')}/`,
      source: 'manual',
    });
    const map = (await app.inject({ method: 'GET', url: '/api/store/redirects' })).json().data as [
      string,
      string,
    ][];
    expect(map).toContainEqual([path('antiga'), `${path('nova')}/`]);
  });

  it('refuses a duplicated origin (409), the same address on both sides, and a bad destination', async () => {
    await create(path('dup'), path('alvo'));
    expect(
      (await admin('POST', '', owner, { from_path: path('dup'), to_path: path('outro') }))
        .statusCode
    ).toBe(409);
    expect(
      (await admin('POST', '', owner, { from_path: path('igual'), to_path: `${path('igual')}/` }))
        .statusCode
    ).toBe(400);
    expect(
      (await admin('POST', '', owner, { from_path: path('x'), to_path: 'javascript:alert(1)' }))
        .statusCode
    ).toBe(400);
    expect(
      (await admin('POST', '', owner, { from_path: '/', to_path: path('x') })).statusCode
    ).toBe(400);
  });

  it('refuses a redirect that would close a loop through existing ones', async () => {
    await create(path('l1'), path('l2'));
    await create(path('l2'), path('l3'));
    const closing = await admin('POST', '', owner, { from_path: path('l3'), to_path: path('l1') });
    expect(closing.statusCode).toBe(400);
    expect(closing.json().message).toContain('laço');
  });

  it('a PATCH with one field keeps the other, and the loop rule also applies to edits', async () => {
    const a = await create(path('e1'), path('e2'));
    await create(path('e2'), path('e3'));
    const noted = (await admin('PATCH', `/${a.redirect_id}`, owner, { note: 'só a nota' })).json()
      .data;
    expect(noted).toMatchObject({
      note: 'só a nota',
      from_path: path('e1'),
      to_path: `${path('e2')}/`,
    });
    const loop = await admin('PATCH', `/${a.redirect_id}`, owner, {
      from_path: path('e3'),
      to_path: path('e1'),
    });
    expect(loop.statusCode).toBe(400);
  });

  it('filters by origin and searches the addresses', async () => {
    await prisma.redirect.create({
      data: { from_path: path('da-tray'), to_path: `${path('x')}/`, source: 'tray' },
    });
    const tray = (await admin('GET', `?source=tray&q=it-${run}`, owner)).json().data as {
      source: string;
    }[];
    expect(tray.length).toBeGreaterThanOrEqual(1);
    expect(tray.every((row) => row.source === 'tray')).toBe(true);
  });

  it('deletes and answers 404 afterwards', async () => {
    const gone = await create(path('apagar'), path('x'));
    expect((await admin('DELETE', `/${gone.redirect_id}`, owner)).statusCode).toBe(204);
    expect((await admin('PATCH', `/${gone.redirect_id}`, owner, { note: 'x' })).statusCode).toBe(
      404
    );
  });

  it('viewer reads but cannot write; stock has no access; anonymous is 401', async () => {
    expect((await admin('GET', '', viewer)).statusCode).toBe(200);
    expect(
      (await admin('POST', '', viewer, { from_path: path('v'), to_path: path('w') })).statusCode
    ).toBe(403);
    expect((await admin('GET', '', stock)).statusCode).toBe(403);
    expect((await admin('GET', '')).statusCode).toBe(401);
  });
});
