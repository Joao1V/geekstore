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
import { findStockDivergences } from '../stock/stock-reconciliation';
import { loadCartSkus } from './cart-lines';

describe('order returns (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let owner: string;
  const run = randomUUID().slice(0, 8);

  const placeOrder = async (quantity: number) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/store/checkout',
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        items: [{ sku_id: fx.skuId, quantity }],
        contact: { name: 'Maria Teste', email: `return-${run}@exemplo.com` },
        shipping_service: 'pickup',
        payment: { method: 'card', installments: 1, card_token: 'mock_tok_approved_4242' },
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data as { order_id: string; number: number };
  };

  const call = (path: string, payload: object = {}) =>
    app.inject({
      method: 'POST',
      url: `/api/orders${path}`,
      headers: { authorization: `Bearer ${owner}` },
      payload,
    });

  const level = (locationType: 'warehouse' | 'quarantine') =>
    prisma.stockLevel.findFirst({
      where: { sku_id: fx.skuId, location: { type: locationType } },
    });

  const shippedOrder = async (quantity: number) => {
    const order = await placeOrder(quantity);
    expect((await call(`/${order.number}/ship`, { carrier: 'Correios' })).statusCode).toBe(200);
    return order;
  };

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
    const ids = orders.map((order) => order.order_id);
    await deleteOutboxEvents({ entity_id: { in: ids } });
    await prisma.orderReturn.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { user_id: fx.userId } });
    await prisma.stockReservation.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.order.deleteMany({ where: { order_id: { in: ids } } });
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('only accepts a return for items that were shipped', async () => {
    const order = await placeOrder(1);
    const early = await call(`/${order.number}/returns`, {
      reason: 'Não gostei',
      items: [{ sku_id: fx.skuId, quantity: 1 }],
    });
    expect(early.statusCode).toBe(409);
  });

  it('does not touch the stock until the return arrives, then splits it between warehouse and quarantine', async () => {
    const order = await shippedOrder(3);
    const warehouseBefore = (await level('warehouse'))?.on_hand ?? 0;

    const requested = await call(`/${order.number}/returns`, {
      reason: 'Veio com defeito',
      items: [{ sku_id: fx.skuId, quantity: 2 }],
    });
    expect(requested.statusCode).toBe(200);
    const [pending] = requested.json().data.returns;
    expect(pending).toMatchObject({ status: 'requested', reason: 'Veio com defeito' });
    expect((await level('warehouse'))?.on_hand).toBe(warehouseBefore);

    // A soma da avaliação precisa fechar com o que foi pedido.
    const wrong = await call(`/${order.number}/returns/${pending.order_return_id}/receive`, {
      items: [{ sku_id: fx.skuId, resellable_quantity: 1, damaged_quantity: 2 }],
    });
    expect(wrong.statusCode).toBe(400);

    const received = await call(`/${order.number}/returns/${pending.order_return_id}/receive`, {
      items: [{ sku_id: fx.skuId, resellable_quantity: 1, damaged_quantity: 1 }],
    });
    expect(received.statusCode).toBe(200);
    expect(received.json().data.returns[0]).toMatchObject({ status: 'received' });
    expect((await level('warehouse'))?.on_hand).toBe(warehouseBefore + 1);
    expect((await level('quarantine'))?.on_hand).toBeGreaterThanOrEqual(1);

    // A quarentena não vira estoque vendável: o disponível da loja só conta o depósito.
    const warehouse = await level('warehouse');
    const available = (await loadCartSkus([fx.skuId])).get(fx.skuId)?.available;
    expect(available).toBe((warehouse?.on_hand ?? 0) - (warehouse?.reserved ?? 0));

    const again = await call(`/${order.number}/returns/${pending.order_return_id}/receive`, {
      items: [{ sku_id: fx.skuId, resellable_quantity: 1, damaged_quantity: 1 }],
    });
    expect(again.statusCode).toBe(409);

    // O livro-razão continua batendo com o saldo.
    const mine = (await findStockDivergences()).filter((row) => row.sku_id === fx.skuId);
    expect(mine).toEqual([]);
  });

  it('never returns more than was bought, counting returns already open', async () => {
    const order = await shippedOrder(2);
    const first = await call(`/${order.number}/returns`, {
      reason: 'Primeira',
      items: [{ sku_id: fx.skuId, quantity: 1 }],
    });
    expect(first.statusCode).toBe(200);
    const tooMany = await call(`/${order.number}/returns`, {
      reason: 'Segunda',
      items: [{ sku_id: fx.skuId, quantity: 2 }],
    });
    expect(tooMany.statusCode).toBe(409);
    const rest = await call(`/${order.number}/returns`, {
      reason: 'Segunda',
      items: [{ sku_id: fx.skuId, quantity: 1 }],
    });
    expect(rest.statusCode).toBe(200);
    expect(await prisma.orderReturn.count({ where: { order_id: order.order_id } })).toBe(2);
  });
});
