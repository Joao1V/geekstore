import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { createUser } from '../../test-support/fixtures';

const CPF = '529.982.247-25';
const address = (over: Record<string, unknown> = {}) => ({
  recipient: 'Maria Teste',
  zip: '14780-000',
  street: 'Rua das Flores',
  number: '123',
  neighborhood: 'Centro',
  city: 'Barretos',
  state: 'sp',
  ...over,
});

describe('customer account (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  const run = randomUUID().slice(0, 8);
  const emailA = `cliente-a-${run}@exemplo.com`;
  const emailB = `cliente-b-${run}@exemplo.com`;
  const password = 'senha-forte-123';
  let tokenA = '';
  let tokenB = '';
  let adminToken = '';
  let adminId = '';
  let refreshCookie = '';

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    token?: string,
    payload?: unknown
  ) =>
    app.inject({
      method,
      url: `/api/customer${url}`,
      payload: payload as object | undefined,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  beforeAll(async () => {
    app = await buildTestApp();
    const admin = await createUser('owner', run);
    adminId = admin.user_id;
    adminToken = app.jwt.sign({ sub: admin.user_id, role: 'owner' });
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await prisma.user.delete({ where: { user_id: adminId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('creates the account, keeps only the digits of the CPF and signs in right away', async () => {
    const response = await call('POST', '/auth/register', undefined, {
      name: 'Maria A',
      email: emailA.toUpperCase(),
      password,
      document: CPF,
      phone: '(17) 99999-0000',
    });
    expect(response.statusCode).toBe(201);
    const { data } = response.json();
    expect(data.customer).toMatchObject({
      email: emailA,
      document: '52998224725',
      phone: '17999990000',
    });
    expect(data.customer.password_hash).toBeUndefined();
    tokenA = data.access_token;
    refreshCookie = String(response.headers['set-cookie']).split(';')[0] ?? '';
    expect(refreshCookie).toContain('geekstore_customer_refresh=');
  });

  it('refuses a repeated e-mail, a short password and an invalid CPF', async () => {
    const same = await call('POST', '/auth/register', undefined, {
      name: 'Outra',
      email: emailA,
      password,
    });
    expect(same.statusCode).toBe(409);
    const short = await call('POST', '/auth/register', undefined, {
      name: 'X Y',
      email: emailB,
      password: '123',
    });
    expect(short.statusCode).toBe(400);
    const badCpf = await call('POST', '/auth/register', undefined, {
      name: 'Maria B',
      email: emailB,
      password,
      document: '111.111.111-11',
    });
    expect(badCpf.statusCode).toBe(400);
  });

  it('signs in, and gives the same answer for a wrong password and an unknown e-mail', async () => {
    const ok = await call('POST', '/auth/login', undefined, { email: emailA, password });
    expect(ok.statusCode).toBe(200);
    const wrong = await call('POST', '/auth/login', undefined, {
      email: emailA,
      password: 'senha-errada-1',
    });
    const unknown = await call('POST', '/auth/login', undefined, {
      email: `nada-${run}@exemplo.com`,
      password,
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().message).toBe(unknown.json().message);
  });

  it('serves /me only with a customer token, and a customer token never opens the admin', async () => {
    expect((await call('GET', '/me')).statusCode).toBe(401);
    expect((await call('GET', '/me', adminToken)).statusCode).toBe(401);
    const me = await call('GET', '/me', tokenA);
    expect(me.statusCode).toBe(200);
    expect(me.json().data.email).toBe(emailA);

    const asAdmin = await app.inject({
      method: 'GET',
      url: '/api/catalog/categories',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(asAdmin.statusCode).toBe(401);
  });

  it('renews the session from the cookie and rotates the refresh token', async () => {
    const renewed = await app.inject({
      method: 'POST',
      url: '/api/customer/auth/refresh',
      headers: { cookie: refreshCookie },
    });
    expect(renewed.statusCode).toBe(200);
    expect(renewed.json().data.access_token).toBeTruthy();
    // O cookie antigo já foi trocado: usar de novo é recusado (e derruba as sessões).
    const reused = await app.inject({
      method: 'POST',
      url: '/api/customer/auth/refresh',
      headers: { cookie: refreshCookie },
    });
    expect(reused.statusCode).toBe(401);
  });

  it('updates the profile', async () => {
    const updated = await call('PATCH', '/me', tokenA, { name: 'Maria Atualizada', phone: '' });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({ name: 'Maria Atualizada', phone: null });
  });

  it('manages addresses: first is the default, a new default replaces it, deleting promotes another', async () => {
    const first = (await call('POST', '/addresses', tokenA, address())).json().data;
    expect(first).toMatchObject({ zip: '14780000', state: 'SP', is_default: true });
    const second = (
      await call('POST', '/addresses', tokenA, address({ street: 'Rua Dois', is_default: true }))
    ).json().data;
    expect(second.is_default).toBe(true);

    let list = (await call('GET', '/addresses', tokenA)).json().data;
    expect(list.map((a: { address_id: string }) => a.address_id)).toEqual([
      second.address_id,
      first.address_id,
    ]);
    expect(list.filter((a: { is_default: boolean }) => a.is_default)).toHaveLength(1);

    const edited = await call('PATCH', `/addresses/${first.address_id}`, tokenA, {
      number: '999',
      is_default: true,
    });
    expect(edited.json().data).toMatchObject({ number: '999', is_default: true });

    await call('DELETE', `/addresses/${first.address_id}`, tokenA);
    list = (await call('GET', '/addresses', tokenA)).json().data;
    expect(list).toHaveLength(1);
    expect(list[0].is_default).toBe(true); // o que sobrou virou o padrão
  });

  it('keeps one customer out of another one’s addresses', async () => {
    const created = await call('POST', '/auth/register', undefined, {
      name: 'Maria B',
      email: emailB,
      password,
    });
    tokenB = created.json().data.access_token;
    const mine = (await call('POST', '/addresses', tokenB, address())).json().data;
    const [theirs] = (await call('GET', '/addresses', tokenA)).json().data;

    expect((await call('GET', '/addresses', tokenB)).json().data).toHaveLength(1);
    expect(
      (await call('PATCH', `/addresses/${theirs.address_id}`, tokenB, { number: '1' })).statusCode
    ).toBe(404);
    expect((await call('DELETE', `/addresses/${theirs.address_id}`, tokenB)).statusCode).toBe(404);
    expect((await call('DELETE', `/addresses/${mine.address_id}`, tokenA)).statusCode).toBe(404);
  });

  it('validates the address (CEP with 8 digits, valid state)', async () => {
    expect((await call('POST', '/addresses', tokenA, address({ zip: '123' }))).statusCode).toBe(
      400
    );
    expect((await call('POST', '/addresses', tokenA, address({ state: 'XX' }))).statusCode).toBe(
      400
    );
  });

  it('signs out: the cookie stops working', async () => {
    const login = await call('POST', '/auth/login', undefined, { email: emailA, password });
    const cookie = String(login.headers['set-cookie']).split(';')[0] ?? '';
    const out = await app.inject({
      method: 'POST',
      url: '/api/customer/auth/logout',
      headers: { cookie },
    });
    expect(out.statusCode).toBe(204);
    const after = await app.inject({
      method: 'POST',
      url: '/api/customer/auth/refresh',
      headers: { cookie },
    });
    expect(after.statusCode).toBe(401);
  });
});
