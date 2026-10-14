import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { PublishedEvent } from '../../core/outbox/outbox';
import { buildTestApp } from '../../test-support/build-test-app';
import {
  type CatalogFixture,
  createCatalogFixture,
  deleteOutboxEvents,
} from '../../test-support/fixtures';
import type { EmailSender } from '../notifications/email-sender';
import { handleOutboxEvent } from '../notifications/notification.service';
import { notifyBackInStock } from './engagement.service';

describe('newsletter and back-in-stock alerts (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  const run = randomUUID().slice(0, 8);
  const email = `news-${run}@exemplo.com`;
  const alertEmail = `alert-${run}@exemplo.com`;

  const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload });
  const deliver = async (where: { type: string; entity_id: string }): Promise<string> => {
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where,
      orderBy: { created_at: 'desc' },
    });
    const send = vi.fn().mockResolvedValue({ id: 'm1' });
    const sender: EmailSender = { name: 'fake', send };
    await handleOutboxEvent(
      { ...event, payload: event.payload as PublishedEvent['payload'] },
      sender
    );
    expect(send).toHaveBeenCalledTimes(1);
    return String(send.mock.calls[0]?.[0].text);
  };

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
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 0, reserved: 0 },
      update: { on_hand: 0, reserved: 0 },
    });
  });

  afterAll(async () => {
    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    const alerts = await prisma.stockAlert.findMany({ where: { sku_id: fx.skuId } });
    await deleteOutboxEvents({
      OR: [
        { entity_id: { in: alerts.map((a) => a.stock_alert_id) } },
        ...(subscriber ? [{ entity_id: subscriber.newsletter_subscriber_id }] : []),
      ],
    });
    await prisma.stockAlert.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.newsletterSubscriber.deleteMany({ where: { email } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('subscribes with double opt-in, confirms once from the e-mail link and can unsubscribe', async () => {
    expect((await post('/api/store/newsletter', { email })).statusCode).toBe(200);
    const subscriber = await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
    expect(subscriber.confirmed_at).toBeNull();

    const text = await deliver({
      type: 'newsletter.confirmation_requested',
      entity_id: subscriber.newsletter_subscriber_id,
    });
    const confirmToken = /confirmar\/\?token=([^\s&]+)/.exec(text)?.[1];
    const unsubscribeToken = /cancelar\/\?token=([^\s&]+)/.exec(text)?.[1];
    if (!confirmToken || !unsubscribeToken) throw new Error('links ausentes no e-mail');

    // Um link de um tipo não vale para o outro.
    expect(
      (await post('/api/store/newsletter/confirm', { token: unsubscribeToken })).statusCode
    ).toBe(400);
    expect((await post('/api/store/newsletter/confirm', { token: confirmToken })).statusCode).toBe(
      200
    );
    expect(
      (await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).confirmed_at
    ).not.toBeNull();

    // Já confirmado: pedir de novo não manda outro e-mail.
    const events = await prisma.outboxEvent.count({
      where: {
        type: 'newsletter.confirmation_requested',
        entity_id: subscriber.newsletter_subscriber_id,
      },
    });
    await post('/api/store/newsletter', { email });
    expect(
      await prisma.outboxEvent.count({
        where: {
          type: 'newsletter.confirmation_requested',
          entity_id: subscriber.newsletter_subscriber_id,
        },
      })
    ).toBe(events);

    expect(
      (await post('/api/store/newsletter/unsubscribe', { token: unsubscribeToken })).statusCode
    ).toBe(200);
    expect(
      (await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).unsubscribed_at
    ).not.toBeNull();
    expect(
      (await post('/api/store/newsletter/unsubscribe', { token: 'lixo.lixo-lixo-lixo-lixo' }))
        .statusCode
    ).toBe(400);
  });

  it('answers the same whether or not the e-mail was already signed up', async () => {
    const first = await post('/api/store/newsletter', { email: `dup-${run}@exemplo.com` });
    const second = await post('/api/store/newsletter', { email: `dup-${run}@exemplo.com` });
    expect(first.json()).toEqual(second.json());
    const dup = await prisma.newsletterSubscriber.findUniqueOrThrow({
      where: { email: `dup-${run}@exemplo.com` },
    });
    await deleteOutboxEvents({ entity_id: dup.newsletter_subscriber_id });
    await prisma.newsletterSubscriber.delete({ where: { email: `dup-${run}@exemplo.com` } });
  });

  it('only takes an alert for a sold-out SKU, and warns once when it comes back', async () => {
    const body = { sku_id: fx.skuId, email: alertEmail };
    expect((await post('/api/store/stock-alerts', body)).statusCode).toBe(200);
    // Repetir o pedido não duplica.
    expect((await post('/api/store/stock-alerts', body)).statusCode).toBe(200);
    expect(await prisma.stockAlert.count({ where: { sku_id: fx.skuId, email: alertEmail } })).toBe(
      1
    );

    // Sem estoque: nada a avisar ainda.
    await notifyBackInStock();
    expect(
      (await prisma.stockAlert.findFirstOrThrow({ where: { sku_id: fx.skuId } })).notified_at
    ).toBeNull();

    await prisma.stockLevel.updateMany({ where: { sku_id: fx.skuId }, data: { on_hand: 3 } });
    expect(await notifyBackInStock()).toBeGreaterThanOrEqual(1);
    const alert = await prisma.stockAlert.findFirstOrThrow({ where: { sku_id: fx.skuId } });
    expect(alert.notified_at).not.toBeNull();

    const text = await deliver({ type: 'stock.back_in_stock', entity_id: alert.stock_alert_id });
    expect(text).toContain('/produto/');
    // Avisou: a segunda varredura não repete.
    const before = await prisma.outboxEvent.count({ where: { entity_id: alert.stock_alert_id } });
    await notifyBackInStock();
    expect(await prisma.outboxEvent.count({ where: { entity_id: alert.stock_alert_id } })).toBe(
      before
    );

    // Com estoque, um pedido novo é recusado (é só comprar).
    expect(
      (
        await post('/api/store/stock-alerts', {
          sku_id: fx.skuId,
          email: `outro-${run}@exemplo.com`,
        })
      ).statusCode
    ).toBe(409);
    expect(
      (await post('/api/store/stock-alerts', { sku_id: randomUUID(), email: alertEmail }))
        .statusCode
    ).toBe(404);
  });
});
