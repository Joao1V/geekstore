import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type PublishedEvent,
  publishPendingEvents,
  writeOutboxEvent,
} from '../../core/outbox/outbox';
import { buildTestApp } from '../../test-support/build-test-app';
import {
  type CatalogFixture,
  createCatalogFixture,
  deleteOutboxEvents,
} from '../../test-support/fixtures';
import type { EmailSender } from './email-sender';
import { handleOutboxEvent } from './notification.service';

describe('outbox and e-mails (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let owner: string;
  const run = randomUUID().slice(0, 8);
  const eventIds: string[] = [];

  const sender = () => {
    const send = vi.fn().mockResolvedValue({ id: 'msg_1' });
    return { send, impl: { name: 'fake', send } as EmailSender };
  };

  const placeOrder = async (payment: object) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity: 1 }],
        contact: { name: 'Maria Teste', email: `maria-${run}@exemplo.com` },
        shipping_service: 'pickup',
        payment,
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data as { order_id: string; number: number };
  };

  const eventsOf = (orderId: string) =>
    prisma.outboxEvent.findMany({ where: { entity_id: orderId }, orderBy: { created_at: 'asc' } });

  const asPublished = (event: {
    outbox_event_id: string;
    type: string;
    entity_type: string;
    entity_id: string;
    version: number;
    payload: unknown;
  }): PublishedEvent => ({ ...event, payload: event.payload as PublishedEvent['payload'] });

  beforeAll(async () => {
    app = await buildTestApp();
    fx = await createCatalogFixture();
    owner = app.jwt.sign({ sub: fx.userId, role: 'owner' });
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
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { items: { some: { sku_id: fx.skuId } } },
      select: { order_id: true },
    });
    const orderIds = orders.map((o) => o.order_id);
    await deleteOutboxEvents({
      OR: [{ entity_id: { in: orderIds } }, { outbox_event_id: { in: eventIds } }],
    });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: { in: orderIds } } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('writes the event in the same transaction: it disappears when the transaction rolls back', async () => {
    const entityId = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await writeOutboxEvent(tx, { type: 'order.created', entityType: 'order', entityId });
        throw new Error('desfaz');
      })
    ).rejects.toThrow('desfaz');
    expect(await prisma.outboxEvent.count({ where: { entity_id: entityId } })).toBe(0);
  });

  it('records order.created with the order and order.paid when the payment is approved', async () => {
    const order = await placeOrder({ method: 'pix' });
    expect((await eventsOf(order.order_id)).map((e) => e.type)).toEqual(['order.created']);

    const approved = await app.inject({
      method: 'POST',
      url: `/api/store/orders/${order.order_id}/simulate-payment`,
    });
    expect(approved.statusCode).toBe(200);
    expect((await eventsOf(order.order_id)).map((e) => e.type)).toEqual([
      'order.created',
      'order.paid',
    ]);
  });

  it('records shipped, delivered and cancelled from the admin flow', async () => {
    const call = (path: string, payload: object = {}) =>
      app.inject({
        method: 'POST',
        url: `/api/orders${path}`,
        headers: { authorization: `Bearer ${owner}` },
        payload,
      });
    const order = await placeOrder({
      method: 'card',
      installments: 1,
      card_token: 'mock_tok_approved_4242',
    });
    expect(
      (await call(`/${order.number}/ship`, { carrier: 'Correios', tracking_code: 'BR123' }))
        .statusCode
    ).toBe(200);
    expect((await call(`/${order.number}/deliver`)).statusCode).toBe(200);
    expect((await eventsOf(order.order_id)).map((e) => e.type)).toEqual([
      'order.created',
      'order.paid',
      'order.shipped',
      'order.delivered',
    ]);

    const second = await placeOrder({ method: 'pix' });
    expect((await call(`/${second.number}/cancel`, { reason: 'Mudei de ideia' })).statusCode).toBe(
      200
    );
    expect((await eventsOf(second.order_id)).map((e) => e.type)).toContain('order.cancelled');
  });

  it('publishes pending events once, and backs off when the queue is down', async () => {
    const order = await placeOrder({ method: 'pix' });
    const [event] = await eventsOf(order.order_id);
    if (!event) throw new Error('sem evento');

    const failing = vi.fn().mockRejectedValue(new Error('redis fora'));
    await publishPendingEvents(failing, { onlyIds: [event.outbox_event_id] });
    const retried = await prisma.outboxEvent.findUniqueOrThrow({
      where: { outbox_event_id: event.outbox_event_id },
    });
    expect(retried).toMatchObject({ status: 'pending', attempts: 1, last_error: 'redis fora' });
    expect(retried.available_at.getTime()).toBeGreaterThan(Date.now());

    // Ainda dentro do recuo: o publicador não pega.
    const idle = vi.fn().mockResolvedValue(undefined);
    await publishPendingEvents(idle, { onlyIds: [event.outbox_event_id] });
    expect(idle.mock.calls.map(([e]) => (e as PublishedEvent).outbox_event_id)).not.toContain(
      event.outbox_event_id
    );

    // Passado o recuo, publica uma vez.
    const ok = vi.fn().mockResolvedValue(undefined);
    await publishPendingEvents(ok, {
      now: new Date(Date.now() + 60 * 60_000),
      onlyIds: [event.outbox_event_id],
    });
    expect(ok.mock.calls.map(([e]) => (e as PublishedEvent).outbox_event_id)).toContain(
      event.outbox_event_id
    );
    const done = await prisma.outboxEvent.findUniqueOrThrow({
      where: { outbox_event_id: event.outbox_event_id },
    });
    expect(done.status).toBe('published');
    const again = vi.fn().mockResolvedValue(undefined);
    await publishPendingEvents(again, {
      now: new Date(Date.now() + 120 * 60_000),
      onlyIds: [event.outbox_event_id],
    });
    expect(again.mock.calls.map(([e]) => (e as PublishedEvent).outbox_event_id)).not.toContain(
      event.outbox_event_id
    );
  });

  it('marks the event failed after too many attempts and lets the panel retry it', async () => {
    const id = await prisma.$transaction((tx) =>
      writeOutboxEvent(tx, { type: 'order.delivered', entityType: 'order', entityId: randomUUID() })
    );
    eventIds.push(id);
    await prisma.outboxEvent.update({ where: { outbox_event_id: id }, data: { attempts: 7 } });
    await publishPendingEvents(vi.fn().mockRejectedValue(new Error('x')), { onlyIds: [id] });
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { outbox_event_id: id } })).status
    ).toBe('failed');

    const list = await app.inject({
      method: 'GET',
      url: '/api/outbox?status=failed',
      headers: { authorization: `Bearer ${owner}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((e: { outbox_event_id: string }) => e.outbox_event_id)).toContain(
      id
    );

    const retry = await app.inject({
      method: 'POST',
      url: `/api/outbox/${id}/retry`,
      headers: { authorization: `Bearer ${owner}` },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('keeps the panel to the people with queue permissions', async () => {
    const viewer = app.jwt.sign({ sub: fx.userId, role: 'viewer' });
    const manager = app.jwt.sign({ sub: fx.userId, role: 'manager' });
    const headers = (token: string) => ({ authorization: `Bearer ${token}` });
    expect((await app.inject({ method: 'GET', url: '/api/outbox' })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/outbox', headers: headers(viewer) })).statusCode
    ).toBe(403);
    expect(
      (await app.inject({ method: 'GET', url: '/api/outbox', headers: headers(manager) }))
        .statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/outbox/${randomUUID()}/retry`,
          headers: headers(viewer),
        })
      ).statusCode
    ).toBe(403);
  });

  it('sends the awaiting-payment e-mail once, even when the event is processed twice', async () => {
    const order = await placeOrder({ method: 'pix' });
    const [created] = await eventsOf(order.order_id);
    if (!created) throw new Error('sem evento');
    const { send, impl } = sender();

    await handleOutboxEvent(asPublished(created), impl);
    await handleOutboxEvent(asPublished(created), impl);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: `maria-${run}@exemplo.com`,
      subject: expect.stringContaining(`#${order.number}`),
    });
    expect(String(send.mock.calls[0]?.[0].text)).toContain('Pix');
    const rows = await prisma.emailMessage.findMany({
      where: { outbox_event_id: created.outbox_event_id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'sent', template: 'order_awaiting_payment' });
  });

  it('keeps the failure and sends it on the retry; a paid card order only gets the paid e-mail', async () => {
    const pix = await placeOrder({ method: 'pix' });
    const [created] = await eventsOf(pix.order_id);
    if (!created) throw new Error('sem evento');
    const flaky = vi
      .fn()
      .mockRejectedValueOnce(new Error('smtp caiu'))
      .mockResolvedValue({ id: 'msg_2' });
    const impl: EmailSender = { name: 'flaky', send: flaky };

    await expect(handleOutboxEvent(asPublished(created), impl)).rejects.toThrow('smtp caiu');
    expect(
      (
        await prisma.emailMessage.findFirstOrThrow({
          where: { outbox_event_id: created.outbox_event_id },
        })
      ).status
    ).toBe('failed');
    await handleOutboxEvent(asPublished(created), impl);
    expect(flaky).toHaveBeenCalledTimes(2);
    expect(
      (
        await prisma.emailMessage.findFirstOrThrow({
          where: { outbox_event_id: created.outbox_event_id },
        })
      ).status
    ).toBe('sent');

    const card = await placeOrder({
      method: 'card',
      installments: 1,
      card_token: 'mock_tok_approved_4242',
    });
    const { send, impl: cardSender } = sender();
    for (const event of await eventsOf(card.order_id)) {
      await handleOutboxEvent(asPublished(event), cardSender);
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].subject).toContain('Pagamento confirmado');
  });
});
