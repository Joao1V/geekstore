import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { createUser } from '../../test-support/fixtures';

describe('home banners (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let owner: string;
  let viewer: string;
  let stock: string;
  let userIds: string[] = [];
  let originalOrder: string[] = [];
  const run = randomUUID().slice(0, 6);
  const tag = (suffix: string) => `IT ${run} ${suffix}`;

  const admin = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    token?: string,
    payload?: object
  ) =>
    app.inject({
      method,
      url: `/api/content/banners${url}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const make = async (suffix: string, extra: object = {}) =>
    (
      await admin('POST', '', owner, {
        tag: tag(suffix),
        headline: `Linha um\nLinha dois ${suffix}`,
        cta_label: 'Ver',
        href: '/catalogo/',
        ...extra,
      })
    ).json().data as { banner_id: string; position: number; is_active: boolean };
  const storeTags = async () =>
    (
      (await app.inject({ method: 'GET', url: '/api/store/banners' })).json().data as {
        tag: string | null;
      }[]
    ).map((banner) => banner.tag);

  beforeAll(async () => {
    app = await buildTestApp();
    const [o, v, s] = await Promise.all([
      createUser('owner', `bo${run}`),
      createUser('viewer', `bv${run}`),
      createUser('stock', `bs${run}`),
    ]);
    userIds = [o.user_id, v.user_id, s.user_id];
    owner = app.jwt.sign({ sub: o.user_id, role: 'owner' });
    viewer = app.jwt.sign({ sub: v.user_id, role: 'viewer' });
    stock = app.jwt.sign({ sub: s.user_id, role: 'stock' });
    originalOrder = (
      await prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { created_at: 'asc' }] })
    ).map((banner) => banner.banner_id);
  });

  afterAll(async () => {
    await prisma.banner.deleteMany({ where: { tag: { startsWith: `IT ${run}` } } });
    // Devolve a ordem original dos banners que já existiam.
    for (const [index, id] of originalOrder.entries()) {
      await prisma.banner.update({ where: { banner_id: id }, data: { position: index + 1 } });
    }
    await prisma.auditLog.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.user.deleteMany({ where: { user_id: { in: userIds } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a banner at the end of the order, active by default', async () => {
    const last = await prisma.banner.aggregate({ _max: { position: true } });
    const banner = await make('fim');
    expect(banner.position).toBe((last._max.position ?? 0) + 1);
    expect(banner.is_active).toBe(true);
    expect(await storeTags()).toContain(tag('fim'));
  });

  it('only accepts a store path or an https link as the button destination', async () => {
    const bad = (href: string) => admin('POST', '', owner, { headline: 'x', cta_label: 'y', href });
    expect((await bad('javascript:alert(1)')).statusCode).toBe(400);
    expect((await bad('//evil.com')).statusCode).toBe(400);
    expect((await bad('data:text/html,x')).statusCode).toBe(400);
    expect((await bad('https://parceiro.com/promo')).statusCode).toBe(201);
    await prisma.banner.deleteMany({ where: { href: 'https://parceiro.com/promo' } });
  });

  it('a deactivated banner or one outside its dates is not shown in the store', async () => {
    const off = await make('off', { is_active: false });
    const future = await make('futuro', {
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const past = await make('passado', {
      ends_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const live = await make('janela', {
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const tags = await storeTags();
    expect(tags).not.toContain(tag('off'));
    expect(tags).not.toContain(tag('futuro'));
    expect(tags).not.toContain(tag('passado'));
    expect(tags).toContain(tag('janela'));
    expect([off, future, past, live]).toHaveLength(4);
  });

  it('rejects an end date before the start, also when merged on a PATCH', async () => {
    expect(
      (
        await admin('POST', '', owner, {
          headline: 'x',
          cta_label: 'y',
          href: '/',
          starts_at: '2027-02-01T00:00:00.000Z',
          ends_at: '2027-01-01T00:00:00.000Z',
        })
      ).statusCode
    ).toBe(400);
    const banner = await make('datas', { starts_at: '2027-01-01T00:00:00.000Z' });
    const bad = await admin('PATCH', `/${banner.banner_id}`, owner, {
      ends_at: '2026-06-01T00:00:00.000Z',
    });
    expect(bad.statusCode).toBe(400);
  });

  it('a PATCH with one field leaves the others untouched', async () => {
    const banner = await make('parcial', {
      text: 'Texto',
      image_url: 'https://cdn.exemplo.test/a.jpg',
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: '2027-01-01T00:00:00.000Z',
    });
    const toggled = (
      await admin('PATCH', `/${banner.banner_id}`, owner, { is_active: false })
    ).json().data;
    expect(toggled).toMatchObject({
      is_active: false,
      text: 'Texto',
      image_url: 'https://cdn.exemplo.test/a.jpg',
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: '2027-01-01T00:00:00.000Z',
      cta_label: 'Ver',
    });
  });

  it('reorders with the whole list and refuses a partial or repeated one', async () => {
    const all = (await admin('GET', '', owner)).json().data as { banner_id: string }[];
    const ids = all.map((banner) => banner.banner_id);
    expect((await admin('PUT', '/order', owner, { banner_ids: ids.slice(1) })).statusCode).toBe(
      400
    );
    expect((await admin('PUT', '/order', owner, { banner_ids: [ids[0], ids[0]] })).statusCode).toBe(
      400
    );

    const reversed = [...ids].reverse();
    const response = await admin('PUT', '/order', owner, { banner_ids: reversed });
    expect(response.statusCode).toBe(200);
    expect((response.json().data as { banner_id: string }[]).map((b) => b.banner_id)).toEqual(
      reversed
    );
  });

  it('deletes a banner and answers 404 for one that does not exist', async () => {
    const banner = await make('apagar');
    expect((await admin('DELETE', `/${banner.banner_id}`, owner)).statusCode).toBe(204);
    expect((await admin('PATCH', `/${banner.banner_id}`, owner, { text: 'x' })).statusCode).toBe(
      404
    );
  });

  it('viewer reads but cannot write; stock has no access; anonymous is 401', async () => {
    expect((await admin('GET', '', viewer)).statusCode).toBe(200);
    expect(
      (await admin('POST', '', viewer, { headline: 'x', cta_label: 'y', href: '/' })).statusCode
    ).toBe(403);
    expect((await admin('GET', '', stock)).statusCode).toBe(403);
    expect((await admin('GET', '')).statusCode).toBe(401);
  });
});
