import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { type CatalogFixture, createCatalogFixture, createUser } from '../../test-support/fixtures';

const ADDRESS = {
  recipient: 'Maria Teste',
  zip: '14780000',
  street: 'Rua A',
  number: '1',
  neighborhood: 'Centro',
  city: 'Barretos',
  state: 'SP',
};

describe('admin orders (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let owner: string;
  let support: string;
  let supportId = '';
  const run = randomUUID().slice(0, 8);

  const level = async () =>
    prisma.stockLevel.findFirstOrThrow({ where: { sku_id: fx.skuId, location_id: fx.locationId } });

  /** Pedido pago no cartão (aprovado na hora), com `quantity` unidades. */
  const paidOrder = async (quantity = 1) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity }],
        contact: { name: `Cliente ${run}`, email: `adm-${run}@exemplo.com` },
        shipping_service: 'standard',
        shipping_address: ADDRESS,
        payment: { method: 'card', installments: 1, card_token: 'mock_tok_approved_4242' },
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data as { number: number; order_id: string };
  };

  const call = (method: 'GET' | 'POST', url: string, token?: string, payload?: object) =>
    app.inject({
      method,
      url: `/api/orders${url}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

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
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 20, reserved: 0 },
      update: { on_hand: 20, reserved: 0 },
    });
    owner = app.jwt.sign({ sub: fx.userId, role: 'owner' });
    const supportUser = await createUser('support', `s${run}`);
    supportId = supportUser.user_id;
    support = app.jwt.sign({ sub: supportUser.user_id, role: 'support' });
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { items: { some: { sku_id: fx.skuId } } },
      select: { order_id: true },
    });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({
      where: { order_id: { in: orders.map((order) => order.order_id) } },
    });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.auditLog.deleteMany({ where: { user_id: supportId } });
    await prisma.user.delete({ where: { user_id: supportId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('lists, filters by state and finds by number, customer or SKU', async () => {
    const order = await paidOrder();
    const byNumber = (await call('GET', `/?q=${order.number}`, owner)).json();
    expect(byNumber.data.map((o: { number: number }) => o.number)).toEqual([order.number]);
    expect(byNumber.data[0]).toMatchObject({
      display_status: 'paid',
      payment_method: 'card',
      contact_email: `adm-${run}@exemplo.com`,
    });
    const bySku = (await call('GET', `/?q=${fx.skuCode}`, owner)).json();
    expect(bySku.data.length).toBeGreaterThanOrEqual(1);
    const paid = (await call('GET', '/?status=paid&page_size=50', owner)).json();
    expect(paid.data.every((o: { display_status: string }) => o.display_status === 'paid')).toBe(
      true
    );
    const awaiting = (
      await call('GET', `/?status=awaiting_payment&q=${order.number}`, owner)
    ).json();
    expect(awaiting.data).toEqual([]);
  });

  it('runs the lifecycle: picking, ship (stock leaves only now), no double ship, deliver', async () => {
    const before = await level();
    const order = await paidOrder(2);
    expect(await level()).toMatchObject({ on_hand: before.on_hand, reserved: before.reserved + 2 });

    const picking = await call('POST', `/${order.number}/start-picking`, owner);
    expect(picking.json().data.display_status).toBe('picking');
    expect((await call('POST', `/${order.number}/start-picking`, owner)).statusCode).toBe(409);

    const shipped = await call('POST', `/${order.number}/ship`, owner, {
      carrier: 'Correios',
      tracking_code: 'BR123456789BR',
    });
    expect(shipped.statusCode).toBe(200);
    expect(shipped.json().data).toMatchObject({
      display_status: 'shipped',
      fulfillment_status: 'shipped',
    });
    expect(shipped.json().data.shipments[0]).toMatchObject({
      carrier: 'Correios',
      tracking_code: 'BR123456789BR',
      status: 'shipped',
    });
    // A saída física: o saldo e a reserva descem juntos.
    expect(await level()).toMatchObject({ on_hand: before.on_hand - 2, reserved: before.reserved });
    const movement = await prisma.stockMovement.findFirst({
      where: { reference_id: order.order_id, type: 'outbound' },
    });
    expect(movement?.quantity).toBe(2);

    expect(
      (await call('POST', `/${order.number}/ship`, owner, { carrier: 'Correios' })).statusCode
    ).toBe(409);
    expect(
      (await call('POST', `/${order.number}/cancel`, owner, { reason: 'Mudei de ideia' }))
        .statusCode
    ).toBe(409);
    expect(await level()).toMatchObject({ on_hand: before.on_hand - 2 });

    const delivered = await call('POST', `/${order.number}/deliver`, owner);
    expect(delivered.json().data).toMatchObject({
      display_status: 'delivered',
      status: 'completed',
    });
    expect((await call('POST', `/${order.number}/deliver`, owner)).statusCode).toBe(409);
  });

  it('cancels before shipping and gives the reservation back', async () => {
    const before = await level();
    const order = await paidOrder(3);
    expect((await level()).reserved).toBe(before.reserved + 3);
    const cancelled = await call('POST', `/${order.number}/cancel`, owner, {
      reason: 'Cliente desistiu',
    });
    expect(cancelled.json().data).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'Cliente desistiu',
    });
    expect(await level()).toMatchObject({ on_hand: before.on_hand, reserved: before.reserved });
    expect(
      (await call('POST', `/${order.number}/cancel`, owner, { reason: 'De novo' })).statusCode
    ).toBe(409);
    expect(
      (await call('POST', `/${order.number}/ship`, owner, { carrier: 'Correios' })).statusCode
    ).toBe(409);
    expect((await call('POST', `/${order.number}/cancel`, owner, { reason: 'x' })).statusCode).toBe(
      400
    );
  });

  it('refuses to ship an order that is not paid yet', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity: 1 }],
        contact: { name: 'Cliente Pix', email: `pix-${run}@exemplo.com` },
        shipping_service: 'pickup',
        payment: { method: 'pix' },
      },
    });
    const pending = response.json().data;
    expect(
      (await call('POST', `/${pending.number}/ship`, owner, { carrier: 'Correios' })).statusCode
    ).toBe(409);
    await call('POST', `/${pending.number}/cancel`, owner, { reason: 'Teste' });
  });

  it('lets support read but not change, and keeps customers and visitors out', async () => {
    const order = await paidOrder();
    expect((await call('GET', `/${order.number}`, support)).statusCode).toBe(200);
    expect(
      (await call('POST', `/${order.number}/ship`, support, { carrier: 'Correios' })).statusCode
    ).toBe(403);
    expect(
      (await call('POST', `/${order.number}/cancel`, support, { reason: 'Teste' })).statusCode
    ).toBe(403);
    expect((await call('GET', '/')).statusCode).toBe(401);
    const customerToken = app.jwt.sign({ sub: randomUUID(), aud: 'customer' } as never);
    expect((await call('GET', '/', customerToken)).statusCode).toBe(401);
    expect((await call('GET', '/999999999', owner)).statusCode).toBe(404);
  });

  it('summarizes today, the states and the last 7 days for the dashboard', async () => {
    const before = (await call('GET', '/summary', owner)).json().data;
    const order = await paidOrder();
    const response = await call('GET', '/summary', owner);
    expect(response.statusCode).toBe(200);
    const after = response.json().data;
    expect(after.last_7_days).toHaveLength(7);
    expect(after.today.orders).toBe(before.today.orders + 1);
    expect(after.today.revenue_cents).toBeGreaterThan(before.today.revenue_cents);
    expect(after.by_status.paid).toBe(before.by_status.paid + 1);
    await call('POST', `/${order.number}/cancel`, owner, { reason: 'Teste' });
    const cancelled = (await call('GET', '/summary', owner)).json().data;
    expect(cancelled.by_status.cancelled).toBe(before.by_status.cancelled + 1);
    expect((await call('GET', '/summary')).statusCode).toBe(401);
  });
});
