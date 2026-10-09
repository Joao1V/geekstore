import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { createUser } from '../../test-support/fixtures';

describe('coupons admin (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let owner: string;
  let viewer: string;
  let ownerId = '';
  let viewerId = '';
  const run = randomUUID().slice(0, 6).toUpperCase();
  const codes: string[] = [];
  const code = (suffix: string) => {
    const value = `IT${run}${suffix}`;
    codes.push(value);
    return value;
  };

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: object
  ) =>
    app.inject({
      method,
      url: `/api/pricing/coupons${url}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    app = await buildTestApp();
    const ownerUser = await createUser('owner', `co${run}`);
    const viewerUser = await createUser('viewer', `cv${run}`);
    ownerId = ownerUser.user_id;
    viewerId = viewerUser.user_id;
    owner = app.jwt.sign({ sub: ownerId, role: 'owner' });
    viewer = app.jwt.sign({ sub: viewerId, role: 'viewer' });
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { in: codes } } });
    await prisma.auditLog.deleteMany({ where: { user_id: { in: [ownerId, viewerId] } } });
    await prisma.user.deleteMany({ where: { user_id: { in: [ownerId, viewerId] } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a coupon with the code upper-cased and lists it with its derived status', async () => {
    const created = await call('POST', '', owner, {
      code: code('10').toLowerCase(),
      kind: 'percent',
      value: 10,
      min_subtotal_cents: 5_000,
      max_uses: 3,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      code: code('10'),
      kind: 'percent',
      value: 10,
      uses: 0,
      status: 'active',
      is_active: true,
    });
    const found = (await call('GET', `?q=${code('10').toLowerCase()}`, owner)).json();
    expect(found.data.map((c: { code: string }) => c.code)).toEqual([code('10')]);
  });

  it('rejects the rules that mix fields: percent out of range, free shipping with a value, end before start', async () => {
    const bad = (payload: object) => call('POST', '', owner, { code: code('X'), ...payload });
    expect((await bad({ kind: 'percent', value: 150 })).statusCode).toBe(400);
    expect((await bad({ kind: 'percent', value: 0 })).statusCode).toBe(400);
    expect((await bad({ kind: 'amount', value: 0 })).statusCode).toBe(400);
    expect((await bad({ kind: 'free_shipping', value: 5 })).statusCode).toBe(400);
    expect(
      (
        await bad({
          kind: 'amount',
          value: 500,
          starts_at: '2026-12-31T00:00:00.000Z',
          ends_at: '2026-01-01T00:00:00.000Z',
        })
      ).statusCode
    ).toBe(400);
    expect(
      (await call('POST', '', owner, { code: 'x y', kind: 'amount', value: 500 })).statusCode
    ).toBe(400);
  });

  it('refuses a duplicated code (409)', async () => {
    const body = { code: code('DUP'), kind: 'amount', value: 500 };
    expect((await call('POST', '', owner, body)).statusCode).toBe(201);
    expect((await call('POST', '', owner, body)).statusCode).toBe(409);
  });

  it('derives the status: scheduled, expired, exhausted and inactive', async () => {
    const make = async (suffix: string, extra: object) =>
      (
        await call('POST', '', owner, {
          code: code(suffix),
          kind: 'free_shipping',
          value: 0,
          ...extra,
        })
      ).json().data as { coupon_id: string; status: string };
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();

    expect((await make('AGE', { starts_at: future })).status).toBe('scheduled');
    expect((await make('VEN', { ends_at: past })).status).toBe('expired');
    expect((await make('OFF', { is_active: false })).status).toBe('inactive');
    const spent = await make('ESG', { max_uses: 1 });
    await prisma.coupon.update({ where: { coupon_id: spent.coupon_id }, data: { uses: 1 } });
    const onlyExhausted = (await call('GET', `?status=exhausted&q=IT${run}`, owner)).json();
    expect(onlyExhausted.data.map((c: { code: string }) => c.code)).toEqual([code('ESG')]);
  });

  it('edits only what is sent, checks the merged rule, and keeps the code of a used coupon', async () => {
    const made = (
      await call('POST', '', owner, { code: code('ED'), kind: 'percent', value: 10 })
    ).json().data as { coupon_id: string };

    const changed = await call('PATCH', `/${made.coupon_id}`, owner, {
      value: 20,
      is_active: false,
    });
    expect(changed.json().data).toMatchObject({
      value: 20,
      is_active: false,
      code: code('ED'),
      kind: 'percent',
    });

    // Trocar para frete grátis zera o valor sozinho; trocar o valor para fora da faixa é recusado.
    const free = await call('PATCH', `/${made.coupon_id}`, owner, { kind: 'free_shipping' });
    expect(free.json().data).toMatchObject({ kind: 'free_shipping', value: 0 });
    expect((await call('PATCH', `/${made.coupon_id}`, owner, { kind: 'percent' })).statusCode).toBe(
      400
    );

    await prisma.coupon.update({ where: { coupon_id: made.coupon_id }, data: { uses: 2 } });
    expect(
      (await call('PATCH', `/${made.coupon_id}`, owner, { code: code('NOVO') })).statusCode
    ).toBe(400);
    expect((await call('PATCH', `/${made.coupon_id}`, owner, { max_uses: 1 })).statusCode).toBe(
      400
    );
    expect((await call('PATCH', `/${made.coupon_id}`, owner, { max_uses: 5 })).statusCode).toBe(
      200
    );
  });

  it('a PATCH that sends one field leaves every other field untouched (toggle must not wipe the rules)', async () => {
    const category = await prisma.category.create({
      data: { name: `Cat ${run}`, slug: `cat-pt-${run.toLowerCase()}` },
    });
    try {
      const made = (
        await call('POST', '', owner, {
          code: code('KEEP'),
          kind: 'percent',
          value: 15,
          min_subtotal_cents: 9_000,
          max_uses: 7,
          starts_at: '2026-01-01T00:00:00.000Z',
          ends_at: '2027-01-01T00:00:00.000Z',
          category_ids: [category.category_id],
        })
      ).json().data as { coupon_id: string };

      const toggled = (
        await call('PATCH', `/${made.coupon_id}`, owner, { is_active: false })
      ).json().data;
      expect(toggled).toMatchObject({
        is_active: false,
        value: 15,
        min_subtotal_cents: 9_000,
        max_uses: 7,
        starts_at: '2026-01-01T00:00:00.000Z',
        ends_at: '2027-01-01T00:00:00.000Z',
        category_ids: [category.category_id],
      });
    } finally {
      await prisma.coupon.deleteMany({ where: { code: code('KEEP') } });
      await prisma.category.delete({ where: { category_id: category.category_id } });
    }
  });

  it('deletes a coupon nobody used, but only deactivates one that was used', async () => {
    const fresh = (
      await call('POST', '', owner, { code: code('DEL'), kind: 'amount', value: 100 })
    ).json().data as { coupon_id: string };
    expect((await call('DELETE', `/${fresh.coupon_id}`, owner)).statusCode).toBe(204);
    expect(await prisma.coupon.findUnique({ where: { coupon_id: fresh.coupon_id } })).toBeNull();

    const used = (
      await call('POST', '', owner, { code: code('USO'), kind: 'amount', value: 100 })
    ).json().data as { coupon_id: string };
    await prisma.coupon.update({ where: { coupon_id: used.coupon_id }, data: { uses: 1 } });
    expect((await call('DELETE', `/${used.coupon_id}`, owner)).statusCode).toBe(409);
  });

  it('writes an audit log and is read-only for the viewer profile', async () => {
    const made = (
      await call('POST', '', owner, { code: code('AUD'), kind: 'amount', value: 100 })
    ).json().data as { coupon_id: string };
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'coupon', entity_id: made.coupon_id, action: 'create' },
    });
    expect(log?.user_id).toBe(ownerId);

    expect((await call('GET', '', viewer)).statusCode).toBe(200);
    expect(
      (await call('POST', '', viewer, { code: code('V'), kind: 'amount', value: 100 })).statusCode
    ).toBe(403);
    expect((await call('GET', '')).statusCode).toBe(401);
  });
});
