import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';

const STOCK = 3;
const BUYERS = 10;

/** RNF-09: o saldo nunca fica negativo e nunca se vende o que não existe, mesmo com compras simultâneas. */
describe('checkout concurrency (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  const run = randomUUID().slice(0, 8);

  const buy = (key: string, quantity = 1) =>
    app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': key },
      payload: {
        items: [{ sku_id: fx.skuId, quantity }],
        contact: { name: 'Comprador Teste', email: `buyer-${run}@exemplo.com` },
        shipping_service: 'pickup',
        payment: { method: 'pix' },
      },
    });

  const level = () =>
    prisma.stockLevel.findFirstOrThrow({ where: { sku_id: fx.skuId, location_id: fx.locationId } });

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
      create: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: STOCK, reserved: 0 },
      update: { on_hand: STOCK, reserved: 0 },
    });
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { items: { some: { sku_id: fx.skuId } } },
      select: { order_id: true },
    });
    const ids = orders.map((order) => order.order_id);
    await prisma.outboxEvent.deleteMany({ where: { entity_id: { in: ids } } });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('sells exactly the stock it has when many people buy the last units at once', async () => {
    const responses = await Promise.all(Array.from({ length: BUYERS }, () => buy(randomUUID())));
    const created = responses.filter((response) => response.statusCode === 201);
    const refused = responses.filter((response) => response.statusCode === 409);

    expect(created).toHaveLength(STOCK);
    expect(refused).toHaveLength(BUYERS - STOCK);
    const after = await level();
    expect(after.reserved).toBe(STOCK);
    expect(after.on_hand).toBe(STOCK);
    expect(after.reserved).toBeLessThanOrEqual(after.on_hand);
    expect(
      await prisma.stockReservation.count({ where: { sku_id: fx.skuId, status: 'active' } })
    ).toBe(STOCK);
  });

  it('turns a double click (same idempotency key at the same time) into a single order', async () => {
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.stockLevel.updateMany({
      where: { sku_id: fx.skuId },
      data: { on_hand: STOCK, reserved: 0 },
    });
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 5 }, () => buy(key)));
    const numbers = new Set(responses.map((response) => response.json().data?.number));
    expect(responses.every((response) => response.statusCode === 201)).toBe(true);
    expect(numbers.size).toBe(1);
    expect((await level()).reserved).toBe(1);
  });
});
