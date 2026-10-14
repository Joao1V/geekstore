import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import {
  type CatalogFixture,
  createCatalogFixture,
  deleteOutboxEvents,
} from '../../test-support/fixtures';

describe('customer privacy — LGPD (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  const run = randomUUID().slice(0, 8);
  const email = `lgpd-${run}@exemplo.com`;
  let token: string;
  let customerId: string;
  let orderId: string;

  const auth = () => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await buildTestApp();
    fx = await createCatalogFixture();
    const channel = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    await prisma.price.create({
      data: {
        sku_id: fx.skuId,
        channel_id: channel.channel_id,
        price_cents: 5_000,
        starts_at: new Date(Date.now() - 60_000),
      },
    });
    await prisma.stockLevel.upsert({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 5, reserved: 0 },
      update: { on_hand: 5, reserved: 0 },
    });
    const registered = await app.inject({
      method: 'POST',
      url: '/api/customer/auth/register',
      payload: { name: 'Maria LGPD', email, password: 'senha-lgpd-123', phone: '(11) 91234-5678' },
    });
    expect(registered.statusCode).toBe(201);
    token = registered.json().data.access_token;
    customerId = registered.json().data.customer.customer_id;
    const order = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID(), ...auth() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity: 1 }],
        contact: { name: 'Maria LGPD', email },
        shipping_service: 'pickup',
        payment: { method: 'card', installments: 1, card_token: 'mock_tok_approved_4242' },
      },
    });
    expect(order.statusCode).toBe(201);
    orderId = order.json().data.order_id;
  });

  afterAll(async () => {
    await deleteOutboxEvents({ entity_id: orderId });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: orderId } });
    await prisma.customer.deleteMany({ where: { email } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('needs a signed-in customer for both operations', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/customer/me/export' })).statusCode).toBe(
      401
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/customer/me/delete',
          payload: { confirm_email: email },
        })
      ).statusCode
    ).toBe(401);
  });

  it('exports the account, addresses and orders without the password hash', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/customer/me/export',
      headers: auth(),
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.customer).toMatchObject({ email, name: 'Maria LGPD', has_google_login: false });
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].items[0]).toMatchObject({ quantity: 1, unit_price_cents: 5_000 });
    expect(JSON.stringify(data)).not.toMatch(/password|\$argon2/i);
  });

  it('refuses to delete without the right e-mail, then deletes the account and keeps the order', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/customer/me/delete',
      headers: auth(),
      payload: { confirm_email: 'outra-pessoa@exemplo.com' },
    });
    expect(wrong.statusCode).toBe(400);
    expect(await prisma.customer.count({ where: { customer_id: customerId } })).toBe(1);

    const done = await app.inject({
      method: 'POST',
      url: '/api/customer/me/delete',
      headers: auth(),
      payload: { confirm_email: email },
    });
    expect(done.statusCode).toBe(204);
    expect(await prisma.customer.count({ where: { customer_id: customerId } })).toBe(0);

    // A pessoa não entra mais; o pedido fica para a contabilidade, sem vínculo com a conta.
    const login = await app.inject({
      method: 'POST',
      url: '/api/customer/auth/login',
      payload: { email, password: 'senha-lgpd-123' },
    });
    expect(login.statusCode).toBe(401);
    const order = await prisma.order.findUniqueOrThrow({ where: { order_id: orderId } });
    expect(order.customer_id).toBeNull();
  });
});
