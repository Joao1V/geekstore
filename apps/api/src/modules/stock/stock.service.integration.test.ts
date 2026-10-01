import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError } from '../../core/_errors';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { bulkSetOnHand, createMovement } from './stock.service';
import { reconcileStock } from './stock-reconcile.service';

describe('stock.service (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;

  const slot = () => ({ sku_id: fx.skuId, location_id: fx.locationId });
  const move = (type: 'inbound' | 'outbound' | 'adjustment', quantity: number) =>
    createMovement(fx.userId, { ...slot(), type, quantity, reason: 'teste' });
  const getLevel = () =>
    prisma.stockLevel.findUniqueOrThrow({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
    });
  const ledgerSum = async () =>
    (
      await prisma.stockMovement.aggregate({
        where: { sku_id: fx.skuId },
        _sum: { quantity: true },
      })
    )._sum.quantity ?? 0;

  beforeAll(async () => {
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('concurrent outbounds on the last units: only the possible ones succeed, never negative', async () => {
    await move('inbound', 3);

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => move('outbound', 1)));
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(5);
    for (const failure of rejected) expect(failure.reason).toBeInstanceOf(ConflictError);

    const level = await getLevel();
    expect(level.on_hand).toBe(0);
    // O livro-razão bate com o saldo: 3 entradas - 3 saídas.
    expect(await ledgerSum()).toBe(level.on_hand);
    expect(await prisma.stockMovement.count({ where: { sku_id: fx.skuId } })).toBe(1 + 3);
  });

  it('a larger outbound never oversells when racing with smaller ones', async () => {
    await move('inbound', 3);
    const results = await Promise.allSettled([move('outbound', 2), move('outbound', 2)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const level = await getLevel();
    expect(level.on_hand).toBe(1);
    expect(await ledgerSum()).toBe(level.on_hand);
  });

  it('never lets available (on_hand - reserved) go negative, and the DB CHECK is the safety net', async () => {
    await prisma.stockLevel.update({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
      data: { on_hand: 5, reserved: 4 },
    });
    // disponível = 1: sair 2 deve falhar mesmo havendo 5 físicos
    await expect(move('outbound', 2)).rejects.toBeInstanceOf(ConflictError);
    await expect(
      prisma.$executeRaw`UPDATE stock_level SET on_hand = -1 WHERE sku_id = ${fx.skuId}`
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`UPDATE stock_level SET on_hand = 3 WHERE sku_id = ${fx.skuId}`
    ).rejects.toThrow(); // reserved (4) > on_hand (3)

    await prisma.stockLevel.update({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
      data: { on_hand: 0, reserved: 0 },
    });
    await prisma.stockMovement.deleteMany({ where: { sku_id: fx.skuId } });
  });

  it('bulk set defines absolute on_hand, records the delta and skips unchanged rows', async () => {
    await prisma.stockMovement.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.stockLevel.deleteMany({ where: { sku_id: fx.skuId } });

    const first = await bulkSetOnHand(fx.userId, {
      reason: 'Contagem',
      items: [{ ...slot(), on_hand: 10 }],
    });
    const same = await bulkSetOnHand(fx.userId, {
      reason: 'Contagem',
      items: [{ ...slot(), on_hand: 10 }],
    });
    const down = await bulkSetOnHand(fx.userId, {
      reason: 'Contagem',
      items: [{ ...slot(), on_hand: 4 }],
    });

    expect([first, same, down]).toEqual([1, 0, 1]);
    const movements = await prisma.stockMovement.findMany({
      where: { sku_id: fx.skuId },
      orderBy: { stock_movement_id: 'asc' },
    });
    expect(movements.map((m) => [m.type, m.quantity, m.user_id])).toEqual([
      ['adjustment', 10, fx.userId],
      ['adjustment', -6, fx.userId],
    ]);
    expect((await getLevel()).on_hand).toBe(4);
  });

  it('bulk set below reserved fails and rolls everything back', async () => {
    await prisma.stockLevel.update({
      where: { sku_id_location_id: { sku_id: fx.skuId, location_id: fx.locationId } },
      data: { reserved: 3 },
    });
    const before = await prisma.stockMovement.count({ where: { sku_id: fx.skuId } });

    await expect(
      bulkSetOnHand(fx.userId, { reason: 'x', items: [{ ...slot(), on_hand: 1 }] })
    ).rejects.toBeInstanceOf(ConflictError);

    expect((await getLevel()).on_hand).toBe(4);
    expect(await prisma.stockMovement.count({ where: { sku_id: fx.skuId } })).toBe(before);
    await prisma.stockLevel.updateMany({ where: { sku_id: fx.skuId }, data: { reserved: 0 } });
  });

  it('reconcile finds no divergence for a consistent ledger and flags a tampered level', async () => {
    const clean = await reconcileStock();
    expect(clean.divergences.filter((row) => row.sku_id === fx.skuId)).toEqual([]);

    await prisma.stockLevel.updateMany({ where: { sku_id: fx.skuId }, data: { on_hand: 99 } });
    const tampered = await reconcileStock();
    expect(tampered.divergences.find((row) => row.sku_id === fx.skuId)).toMatchObject({
      level_on_hand: 99,
      ledger_on_hand: 4,
    });
    await prisma.stockLevel.updateMany({ where: { sku_id: fx.skuId }, data: { on_hand: 4 } });
  });
});
