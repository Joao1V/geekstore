import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import {
  type CatalogFixture,
  createCatalogFixture,
  deleteOutboxEvents,
} from '../../test-support/fixtures';

const PRICE = 5_000;

describe('refunds (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let owner: string;
  let stockClerk: string;
  const run = randomUUID().slice(0, 8);

  const placeOrder = async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity: 1 }],
        contact: { name: 'Maria Teste', email: `refund-${run}@exemplo.com` },
        shipping_service: 'pickup',
        payment: { method: 'card', installments: 1, card_token: 'mock_tok_approved_4242' },
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data as { order_id: string; number: number };
  };

  const refund = (number: number, payload: object, token = owner) =>
    app.inject({
      method: 'POST',
      url: `/api/orders/${number}/refunds`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

  const orderRow = (orderId: string) =>
    prisma.order.findUniqueOrThrow({ where: { order_id: orderId } });

  beforeAll(async () => {
    app = await buildTestApp();
    fx = await createCatalogFixture();
    owner = app.jwt.sign({ sub: fx.userId, role: 'owner' });
    stockClerk = app.jwt.sign({ sub: fx.userId, role: 'stock' });
    const channel = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    await prisma.price.create({
      data: {
        sku_id: fx.skuId,
        channel_id: channel.channel_id,
        price_cents: PRICE,
        starts_at: new Date(Date.now() - 60_000),
      },
    });
    await prisma.stockLevel.upsert({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 50, reserved: 0 },
      update: { on_hand: 50, reserved: 0 },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { items: { some: { sku_id: fx.skuId } } },
      select: { order_id: true },
    });
    const ids = orders.map((order) => order.order_id);
    await deleteOutboxEvents({ entity_id: { in: ids } });
    await prisma.refund.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { user_id: fx.userId } });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('refunds part, then the rest, and moves the payment state without touching the order', async () => {
    const order = await placeOrder();
    const partial = await refund(order.number, { amount_cents: 2_000, reason: 'Item avariado' });
    expect(partial.statusCode).toBe(200);
    expect(partial.json().data).toMatchObject({
      payment_status: 'partially_refunded',
      refunded_cents: 2_000,
      status: 'open',
    });
    expect(partial.json().data.refunds).toHaveLength(1);

    // O pedido continua pago o bastante para ser separado e enviado.
    const picking = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.number}/start-picking`,
      headers: { authorization: `Bearer ${owner}` },
    });
    expect(picking.statusCode).toBe(200);

    const rest = await refund(order.number, { reason: 'Cliente desistiu do restante' });
    expect(rest.statusCode).toBe(200);
    expect(rest.json().data).toMatchObject({ payment_status: 'refunded', refunded_cents: PRICE });

    const again = await refund(order.number, { reason: 'De novo' });
    expect(again.statusCode).toBe(409);
    expect(
      await prisma.outboxEvent.count({
        where: { entity_id: order.order_id, type: 'order.refunded' },
      })
    ).toBe(2);
  });

  it('never refunds more than was paid', async () => {
    const order = await placeOrder();
    const tooMuch = await refund(order.number, { amount_cents: PRICE + 1, reason: 'Muito' });
    expect(tooMuch.statusCode).toBe(409);
    expect(tooMuch.json().message).toMatch(/até/);
    expect((await orderRow(order.order_id)).payment_status).toBe('approved');
  });

  it('lets only one of two simultaneous refunds through when together they exceed the payment', async () => {
    const order = await placeOrder();
    const [a, b] = await Promise.all([
      refund(order.number, { amount_cents: 3_000, reason: 'Primeiro clique' }),
      refund(order.number, { amount_cents: 3_000, reason: 'Segundo clique' }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const total = await prisma.refund.aggregate({
      where: { order_id: order.order_id, status: 'succeeded' },
      _sum: { amount_cents: true },
    });
    expect(total._sum.amount_cents).toBe(3_000);
  });

  it('keeps refunds to the people who may move money', async () => {
    const order = await placeOrder();
    expect((await refund(order.number, { reason: 'Teste' }, stockClerk)).statusCode).toBe(403);
    expect((await orderRow(order.order_id)).payment_status).toBe('approved');
  });

  it('records a failed refund and frees the amount when the provider refuses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo';
    try {
      const order = await placeOrder();
      await prisma.payment.updateMany({
        where: { order_id: order.order_id },
        data: { provider: 'mercadopago', external_id: `5${Date.now()}` },
      });
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue({ ok: false, status: 400, text: async () => 'saldo insuficiente' })
      );
      const failed = await refund(order.number, { reason: 'Vai falhar' });
      expect(failed.statusCode).toBe(400);
      const row = await prisma.refund.findFirstOrThrow({ where: { order_id: order.order_id } });
      expect(row).toMatchObject({ status: 'failed' });
      expect(row.error).toContain('400');
      expect((await orderRow(order.order_id)).payment_status).toBe('approved');

      // O valor voltou a estar disponível: a nova tentativa passa.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 77, status: 'approved' }) })
      );
      const retry = await refund(order.number, { reason: 'Agora vai' });
      expect(retry.statusCode).toBe(200);
      expect(retry.json().data.payment_status).toBe('refunded');
    } finally {
      delete process.env.MERCADOPAGO_ACCESS_TOKEN;
      delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    }
  });
});
