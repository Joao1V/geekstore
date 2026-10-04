import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { expirePendingOrders } from './order-flow';

const ADDRESS = {
  recipient: 'Maria Teste',
  zip: '30140071',
  street: 'Av. Afonso Pena',
  number: '100',
  neighborhood: 'Centro',
  city: 'Belo Horizonte',
  state: 'MG',
};

describe('orders (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let channelId: string;
  const run = randomUUID().slice(0, 8);
  const customerEmails: string[] = [];
  const webhookResources: string[] = [];

  const body = (over: Record<string, unknown> = {}) => ({
    items: [{ sku_id: fx.skuId, quantity: 1 }],
    contact: { name: 'Maria Teste', email: `maria-${run}@exemplo.com` },
    shipping_service: 'standard',
    shipping_address: ADDRESS,
    payment: { method: 'pix' },
    ...over,
  });

  const checkout = (payload: object, key = randomUUID(), token?: string) =>
    app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      payload,
      headers: { 'idempotency-key': key, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });

  const level = async () =>
    prisma.stockLevel.findFirstOrThrow({ where: { sku_id: fx.skuId, location_id: fx.locationId } });

  const setStock = async (onHand: number) => {
    await prisma.stockLevel.upsert({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: onHand, reserved: 0 },
      update: { on_hand: onHand, reserved: 0 },
    });
  };

  const webhook = (eventId: string, paymentId: string, state = 'approved') =>
    app.inject({
      method: 'POST',
      url: '/api/webhooks/mock-payments',
      payload: { event_id: eventId, payment_id: paymentId, state },
    });

  beforeAll(async () => {
    app = await buildTestApp();
    fx = await createCatalogFixture();
    channelId = (await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } })).channel_id;
    await prisma.sku.update({ where: { sku_id: fx.skuId }, data: { weight_g: 200 } });
    await prisma.price.create({
      data: {
        sku_id: fx.skuId,
        channel_id: channelId,
        price_cents: 10_000,
        starts_at: new Date(Date.now() - 60_000),
      },
    });
    await setStock(5);
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { items: { some: { sku_id: fx.skuId } } },
      select: { order_id: true },
    });
    const ids = orders.map((order) => order.order_id);
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.webhookEvent.deleteMany({ where: { resource_id: { in: webhookResources } } });
    await prisma.customer.deleteMany({ where: { email: { in: customerEmails } } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('prices everything on the server, reserves the stock and waits for the Pix', async () => {
    await setStock(5);
    const response = await checkout(body({ items: [{ sku_id: fx.skuId, quantity: 3 }] }));
    expect(response.statusCode).toBe(201);
    const order = response.json().data;
    expect(order).toMatchObject({
      status: 'open',
      payment_status: 'pending',
      display_status: 'awaiting_payment',
      subtotal_cents: 30_000,
      shipping_cents: 0, // R$ 300 passa de R$ 299: frete grátis
      discount_cents: 1_500, // 5% do Pix
      total_cents: 28_500,
    });
    expect(order.number).toBeGreaterThanOrEqual(1001);
    expect(order.payment).toMatchObject({ method: 'pix', status: 'pending' });
    expect(String(order.payment.details.pix_code)).toContain('MOCKPIX');
    expect(await level()).toMatchObject({ on_hand: 5, reserved: 3 });

    // Abaixo do mínimo o frete é cobrado (MG, 1 unidade de 200 g): o valor vem da tabela do servidor.
    const small = (await checkout(body())).json().data;
    expect(small.shipping_cents).toBe(1_590);
    expect(small.total_cents).toBe(10_000 + 1_590 - 500);
  });

  it('returns the SAME order for a repeated idempotency key, reserving only once', async () => {
    await setStock(5);
    const key = randomUUID();
    const first = (await checkout(body(), key)).json().data;
    const again = (await checkout(body(), key)).json().data;
    expect(again.order_id).toBe(first.order_id);
    expect(await level()).toMatchObject({ reserved: 1 });
    const parallel = await Promise.all([checkout(body(), randomUUID()), checkout(body(), key)]);
    expect(parallel[1]?.json().data.order_id).toBe(first.order_id);
  });

  it('freezes the values: a later price change does not touch the order', async () => {
    await setStock(5);
    const order = (await checkout(body())).json().data;
    await prisma.price.create({
      data: { sku_id: fx.skuId, channel_id: channelId, price_cents: 99_900, starts_at: new Date() },
    });
    const read = await app.inject({ method: 'GET', url: `/api/store/orders/${order.order_id}` });
    expect(read.json().data.items[0].unit_price_cents).toBe(10_000);
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId, price_cents: 99_900 } });
  });

  it('refuses when there is not enough stock and creates nothing', async () => {
    await setStock(1);
    const key = randomUUID();
    const response = await checkout(body({ items: [{ sku_id: fx.skuId, quantity: 2 }] }), key);
    expect(response.statusCode).toBe(409);
    expect(await prisma.order.count({ where: { idempotency_key: key } })).toBe(0);
    expect(await level()).toMatchObject({ reserved: 0 });
  });

  it('never oversells: two buyers for the last unit, exactly one wins', async () => {
    await setStock(1);
    const results = await Promise.all([checkout(body()), checkout(body())]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([201, 409]);
    const { on_hand, reserved } = await level();
    expect(reserved).toBe(1);
    expect(reserved).toBeLessThanOrEqual(on_hand);
  });

  it('approves by webhook once, and a repeated event changes nothing', async () => {
    await setStock(5);
    const order = (await checkout(body())).json().data;
    const paymentId = (
      await prisma.payment.findFirstOrThrow({ where: { order_id: order.order_id } })
    ).external_id;
    webhookResources.push(paymentId);

    const first = await webhook(`evt-1-${run}`, paymentId);
    expect(first.json().data.duplicate).toBe(false);
    const paid = (
      await app.inject({ method: 'GET', url: `/api/store/orders/${order.order_id}` })
    ).json().data;
    expect(paid).toMatchObject({ payment_status: 'approved', display_status: 'paid' });
    expect(
      await prisma.stockReservation.count({
        where: { order_id: order.order_id, status: 'committed' },
      })
    ).toBe(1);

    const replay = await webhook(`evt-1-${run}`, paymentId);
    expect(replay.json().data.duplicate).toBe(true);
    const other = await webhook(`evt-2-${run}`, paymentId); // outro evento, mesmo pagamento já aprovado
    expect(other.statusCode).toBe(200);
    expect(await level()).toMatchObject({ reserved: 1 });
    const unknown = `mock_nao_existe_${run}`;
    webhookResources.push(unknown);
    expect((await webhook(`evt-unknown-${run}`, unknown)).statusCode).toBe(404);
  });

  it('charges a card on the spot: approved goes straight to paid, declined creates nothing', async () => {
    await setStock(5);
    const approved = (
      await checkout(
        body({ payment: { method: 'card', installments: 3, card_token: 'mock_tok_approved_4242' } })
      )
    ).json().data;
    expect(approved).toMatchObject({ payment_status: 'approved', display_status: 'paid' });
    expect(approved.payment.details.last4).toBe('4242');
    expect(approved.discount_cents).toBe(0); // desconto de 5% é só do Pix

    // Cartão recusado: nada é criado (sem pedido e sem reserva), e a mesma chave serve para tentar de novo.
    const key = randomUUID();
    const declined = await checkout(
      body({ payment: { method: 'card', card_token: 'mock_tok_declined_0002' } }),
      key
    );
    expect(declined.statusCode).toBe(400);
    expect(declined.json().message).toContain('recusado');
    expect(await prisma.order.count({ where: { idempotency_key: key } })).toBe(0);
    expect((await level()).reserved).toBe(1); // só o pedido aprovado acima
    const retry = await checkout(
      body({ payment: { method: 'card', card_token: 'mock_tok_approved_4242' } }),
      key
    );
    expect(retry.statusCode).toBe(201);
    expect((await checkout(body({ payment: { method: 'card' } }))).statusCode).toBe(400);
    expect(
      (await checkout(body({ payment: { method: 'card', card_token: '4111111111111111' } })))
        .statusCode
    ).toBe(400);
  });

  it('requires an address except for store pickup, and refuses an unknown service', async () => {
    await setStock(5);
    expect((await checkout(body({ shipping_address: undefined }))).statusCode).toBe(400);
    const pickup = await checkout(
      body({ shipping_service: 'pickup', shipping_address: undefined })
    );
    expect(pickup.statusCode).toBe(201);
    expect(pickup.json().data.shipping_cents).toBe(0);
    expect((await checkout(body({ shipping_service: 'drone' }))).statusCode).toBe(400);
    expect(
      (await checkout(body({ items: [{ sku_id: randomUUID(), quantity: 1 }] }))).statusCode
    ).toBe(400);
  });

  it('expires unpaid orders and gives the reservation back', async () => {
    await setStock(5);
    const order = (await checkout(body())).json().data;
    expect(await level()).toMatchObject({ reserved: 1 });
    await prisma.payment.updateMany({
      where: { order_id: order.order_id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    expect(await expirePendingOrders()).toBeGreaterThanOrEqual(1);
    const read = (
      await app.inject({ method: 'GET', url: `/api/store/orders/${order.order_id}` })
    ).json().data;
    expect(read).toMatchObject({ status: 'cancelled', display_status: 'cancelled' });
    expect(await level()).toMatchObject({ reserved: 0 });
  });

  it('reopens an expired order when the payment arrives late and there is stock; otherwise flags it', async () => {
    await setStock(5);
    const order = (await checkout(body())).json().data;
    const payment = await prisma.payment.findFirstOrThrow({ where: { order_id: order.order_id } });
    webhookResources.push(payment.external_id);
    await prisma.payment.update({
      where: { payment_id: payment.payment_id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    await expirePendingOrders();

    await webhook(`late-1-${run}`, payment.external_id);
    const back = (
      await app.inject({ method: 'GET', url: `/api/store/orders/${order.order_id}` })
    ).json().data;
    expect(back).toMatchObject({ status: 'open', payment_status: 'approved' });
    expect(await level()).toMatchObject({ reserved: 1 });

    // Sem estoque na hora da aprovação tardia: o pagamento entra, o pedido fica para tratar.
    await setStock(5);
    const second = (await checkout(body())).json().data;
    const secondPayment = await prisma.payment.findFirstOrThrow({
      where: { order_id: second.order_id },
    });
    webhookResources.push(secondPayment.external_id);
    await prisma.payment.update({
      where: { payment_id: secondPayment.payment_id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    await expirePendingOrders();
    await setStock(0);
    await webhook(`late-2-${run}`, secondPayment.external_id);
    const stuck = (
      await app.inject({ method: 'GET', url: `/api/store/orders/${second.order_id}` })
    ).json().data;
    expect(stuck).toMatchObject({ status: 'cancelled', payment_status: 'approved' });
    const event = await prisma.webhookEvent.findFirstOrThrow({
      where: { event_id: `late-2-${run}` },
    });
    expect(event.state).toBe('failed');
    expect(event.error).toContain('estornar');
  });

  it('applies a coupon on the server and refuses a bad one', async () => {
    await setStock(5);
    const code = `T${run}`.toUpperCase();
    await prisma.coupon.create({
      data: { code, kind: 'percent', value: 10, min_subtotal_cents: 5_000, max_uses: 1 },
    });
    const ok = (await checkout(body({ coupon_code: code }))).json().data;
    expect(ok).toMatchObject({ coupon_code: code, discount_cents: 1_000 + 450 }); // 10% de 100,00 + 5% Pix sobre 90,00
    expect((await checkout(body({ coupon_code: code }))).statusCode).toBe(400); // acabou o limite de usos
    expect((await checkout(body({ coupon_code: 'NAOEXISTE' }))).statusCode).toBe(400);
    await prisma.coupon.delete({ where: { code } });
  });

  it('shows the history only to the owner', async () => {
    await setStock(5);
    const emailA = `hist-a-${run}@exemplo.com`;
    const emailB = `hist-b-${run}@exemplo.com`;
    customerEmails.push(emailA, emailB);
    const register = async (email: string) =>
      (
        await app.inject({
          method: 'POST',
          url: '/api/customer/auth/register',
          payload: { name: 'Cliente Histórico', email, password: 'senha-forte-123' },
        })
      ).json().data.access_token as string;
    const [tokenA, tokenB] = [await register(emailA), await register(emailB)];

    const mine = (await checkout(body(), randomUUID(), tokenA)).json().data;
    await checkout(body(), randomUUID()); // visitante: não entra no histórico de ninguém
    const list = await app.inject({
      method: 'GET',
      url: '/api/customer/orders',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(list.json().data.map((o: { number: number }) => o.number)).toEqual([mine.number]);

    const read = (token: string) =>
      app.inject({
        method: 'GET',
        url: `/api/customer/orders/${mine.number}`,
        headers: { authorization: `Bearer ${token}` },
      });
    expect((await read(tokenA)).statusCode).toBe(200);
    expect((await read(tokenB)).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/customer/orders' })).statusCode).toBe(401);
  });
});
