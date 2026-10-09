import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { createUser } from '../../test-support/fixtures';

describe('content pages (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let owner: string;
  let viewer: string;
  let stock: string;
  let userIds: string[] = [];
  const run = randomUUID().slice(0, 6).toLowerCase();
  const slug = (suffix: string) => `it-${run}-${suffix}`;

  const admin = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: object
  ) =>
    app.inject({
      method,
      url: `/api/content/pages${url}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const store = (url = '') => app.inject({ method: 'GET', url: `/api/store/pages${url}` });
  const create = async (suffix: string, extra: object = {}) =>
    (
      await admin('POST', '', owner, { slug: slug(suffix), title: `Página ${suffix}`, ...extra })
    ).json().data as { page_id: string; status: string; body: string };

  beforeAll(async () => {
    app = await buildTestApp();
    const [o, v, s] = await Promise.all([
      createUser('owner', `po${run}`),
      createUser('viewer', `pv${run}`),
      createUser('stock', `ps${run}`),
    ]);
    userIds = [o.user_id, v.user_id, s.user_id];
    owner = app.jwt.sign({ sub: o.user_id, role: 'owner' });
    viewer = app.jwt.sign({ sub: v.user_id, role: 'viewer' });
    stock = app.jwt.sign({ sub: s.user_id, role: 'stock' });
  });

  afterAll(async () => {
    await prisma.page.deleteMany({ where: { slug: { startsWith: `it-${run}-` } } });
    await prisma.auditLog.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.user.deleteMany({ where: { user_id: { in: userIds } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a draft by default and keeps it out of the store', async () => {
    const page = await create('rascunho', { body: '## Olá' });
    expect(page.status).toBe('draft');
    expect((await store(`/${slug('rascunho')}`)).statusCode).toBe(404);
    const links = (await store()).json().data as { slug: string }[];
    expect(links.map((l) => l.slug)).not.toContain(slug('rascunho'));
  });

  it('publishes: the store serves the Markdown and lists the link', async () => {
    const page = await create('no-ar', { body: '## Prazo\n\n7 dias.' });
    const published = await admin('PATCH', `/${page.page_id}`, owner, { status: 'published' });
    expect(published.json().data.status).toBe('published');

    const served = (await store(`/${slug('no-ar')}`)).json().data;
    expect(served).toMatchObject({
      slug: slug('no-ar'),
      title: 'Página no-ar',
      body: '## Prazo\n\n7 dias.',
    });
    const links = (await store()).json().data as { slug: string }[];
    expect(links.map((l) => l.slug)).toContain(slug('no-ar'));
  });

  it('refuses to publish an empty page', async () => {
    const empty = await create('vazia');
    const response = await admin('PATCH', `/${empty.page_id}`, owner, { status: 'published' });
    expect(response.statusCode).toBe(400);
    expect(
      (await admin('POST', '', owner, { slug: slug('vazia2'), title: 'x', status: 'published' }))
        .statusCode
    ).toBe(400);
  });

  it('a duplicated slug is 409 and an invalid one is 400', async () => {
    await create('dup');
    expect((await admin('POST', '', owner, { slug: slug('dup'), title: 'Outra' })).statusCode).toBe(
      409
    );
    expect((await admin('POST', '', owner, { slug: 'Com Espaço', title: 'x' })).statusCode).toBe(
      400
    );
  });

  it('a published page keeps its address; a draft can change it', async () => {
    const live = await create('endereco', { body: 'texto' });
    await admin('PATCH', `/${live.page_id}`, owner, { status: 'published' });
    expect(
      (await admin('PATCH', `/${live.page_id}`, owner, { slug: slug('novo') })).statusCode
    ).toBe(400);
    await admin('PATCH', `/${live.page_id}`, owner, { status: 'draft' });
    const moved = await admin('PATCH', `/${live.page_id}`, owner, { slug: slug('novo') });
    expect(moved.json().data.slug).toBe(slug('novo'));
  });

  it('a PATCH with one field leaves the others alone', async () => {
    const page = await create('parcial', {
      body: 'texto',
      seo_title: 'Título SEO',
      seo_description: 'Descrição SEO',
      position: 7,
    });
    const changed = (
      await admin('PATCH', `/${page.page_id}`, owner, { title: 'Novo título' })
    ).json().data;
    expect(changed).toMatchObject({
      title: 'Novo título',
      body: 'texto',
      status: 'draft',
      seo_title: 'Título SEO',
      seo_description: 'Descrição SEO',
      position: 7,
    });
  });

  it('only a draft can be deleted', async () => {
    const live = await create('apagar-no-ar', { body: 'texto' });
    await admin('PATCH', `/${live.page_id}`, owner, { status: 'published' });
    expect((await admin('DELETE', `/${live.page_id}`, owner)).statusCode).toBe(409);
    await admin('PATCH', `/${live.page_id}`, owner, { status: 'draft' });
    expect((await admin('DELETE', `/${live.page_id}`, owner)).statusCode).toBe(204);
    expect((await admin('GET', `/${live.page_id}`, owner)).statusCode).toBe(404);
  });

  it('writes an audit log without the whole text', async () => {
    const page = await create('auditoria', { body: 'x'.repeat(500) });
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'page', entity_id: page.page_id, action: 'create' },
    });
    expect(log?.after).toMatchObject({ slug: slug('auditoria'), body_length: 500 });
  });

  it('viewer reads but cannot write; a profile without content access gets 403; anonymous is 401', async () => {
    expect((await admin('GET', '', viewer)).statusCode).toBe(200);
    expect((await admin('POST', '', viewer, { slug: slug('v'), title: 'x' })).statusCode).toBe(403);
    expect((await admin('GET', '', stock)).statusCode).toBe(403);
    expect((await admin('GET', '')).statusCode).toBe(401);
  });
});
