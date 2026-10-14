import { createHmac, randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';

const SECRET = 'segredo-de-teste';

describe('Mercado Pago webhook (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  const run = randomUUID().slice(0, 8);
  const mpIds: string[] = [];

  const sign = (dataId: string, requestId = 'req-1', ts = '1700000000') =>
    `ts=${ts},v1=${createHmac('sha256', SECRET)
      .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
      .digest('hex')}`;

  const notify = (dataId: string, signature = sign(dataId)) =>
    app.inject({
      method: 'POST',
      url: `/api/webhooks/mercadopago?data.id=${dataId}&type=payment`,
      headers: { 'x-signature': signature, 'x-request-id': 'req-1' },
      payload: { type: 'payment', action: 'payment.updated', data: { id: dataId } },
    });

  const stubPayment = (id: string, status: string, statusDetail?: string) =>
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: Number(id), status, status_detail: statusDetail }),
      })
    );

  /** Cria um pedido (pagamento simulado) e passa o pagamento dele para o Mercado Pago. */
  const orderWithMercadoPagoPayment = async (mpId: string) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity: 1 }],
        contact: { name: 'Maria Teste', email: `maria-${run}@exemplo.com` },
        shipping_service: 'pickup',
        payment: { method: 'pix' },
      },
    });
    expect(response.statusCode).toBe(201);
    const order = response.json().data;
    await prisma.payment.updateMany({
      where: { order_id: order.order_id },
      data: { provider: 'mercadopago', external_id: mpId },
    });
    mpIds.push(mpId);
    return order.order_id as string;
  };

  beforeAll(async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
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
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 10, reserved: 0 },
      update: { on_hand: 10, reserved: 0 },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const orders = await prisma.order.findMany({
      where: { items: { some: { sku_id: fx.skuId } } },
      select: { order_id: true },
    });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: { in: orders.map((o) => o.order_id) } } });
    await prisma.webhookEvent.deleteMany({
      where: { provider: 'mercadopago', resource_id: { in: mpIds } },
    });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects a notification with a bad signature without touching anything', async () => {
    const mpId = `9${Date.now()}`;
    const orderId = await orderWithMercadoPagoPayment(mpId);
    stubPayment(mpId, 'approved');
    const response = await notify(mpId, 'ts=1700000000,v1=00');
    expect(response.statusCode).toBe(401);
    const order = await prisma.order.findUniqueOrThrow({ where: { order_id: orderId } });
    expect(order.payment_status).toBe('pending');
  });

  it('approves the order from the payment state read at Mercado Pago, once', async () => {
    const mpId = `8${Date.now()}`;
    const orderId = await orderWithMercadoPagoPayment(mpId);
    stubPayment(mpId, 'approved');

    const first = await notify(mpId);
    expect(first.statusCode).toBe(200);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { order_id: orderId } })).payment_status
    ).toBe('approved');

    // O mesmo aviso de novo não repete nada.
    const again = await notify(mpId);
    expect(again.statusCode).toBe(200);
    expect(again.json().data).toMatchObject({ handled: true });
    expect(
      await prisma.webhookEvent.count({ where: { provider: 'mercadopago', resource_id: mpId } })
    ).toBe(1);
  });

  it('does nothing while the payment is still pending at Mercado Pago', async () => {
    const mpId = `7${Date.now()}`;
    const orderId = await orderWithMercadoPagoPayment(mpId);
    stubPayment(mpId, 'in_process');
    expect((await notify(mpId)).statusCode).toBe(200);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { order_id: orderId } })).payment_status
    ).toBe('pending');
  });

  it('can process an event again when the payment was not saved yet when the notice came', async () => {
    const mpId = `6${Date.now()}`;
    stubPayment(mpId, 'approved');
    mpIds.push(mpId);
    // Chegou antes de o pagamento existir: falha, mas o Mercado Pago vai reenviar.
    expect((await notify(mpId)).statusCode).toBe(404);

    const orderId = await orderWithMercadoPagoPayment(mpId);
    expect((await notify(mpId)).statusCode).toBe(200);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { order_id: orderId } })).payment_status
    ).toBe('approved');
  });

  it('never lets the test route approve a real Mercado Pago payment', async () => {
    const mpId = `5${Date.now()}`;
    const orderId = await orderWithMercadoPagoPayment(mpId);
    const response = await app.inject({
      method: 'POST',
      url: `/api/store/orders/${orderId}/simulate-payment`,
    });
    expect(response.statusCode).toBe(404);
  });
});
