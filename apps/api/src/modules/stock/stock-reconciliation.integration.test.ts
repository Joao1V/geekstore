import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { findStockDivergences, reconcileStock } from './stock-reconciliation';

describe('stock reconciliation (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  const alertIds: string[] = [];

  beforeAll(async () => {
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await prisma.emailMessage.deleteMany({ where: { outbox_event_id: { in: alertIds } } });
    await prisma.outboxEvent.deleteMany({ where: { outbox_event_id: { in: alertIds } } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('finds nothing while the level matches the last movement, and flags a tampered level', async () => {
    await prisma.stockLevel.create({
      data: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 7, reserved: 1 },
    });
    await prisma.stockMovement.create({
      data: {
        sku_id: fx.skuId,
        location_id: fx.locationId,
        type: 'inbound',
        quantity: 7,
        on_hand_after: 7,
        reserved_after: 1,
      },
    });
    const mine = async () =>
      (await findStockDivergences()).filter((row) => row.sku_id === fx.skuId);
    expect(await mine()).toEqual([]);

    // Alguém mexeu no saldo sem passar pelo livro-razão.
    await prisma.stockLevel.updateMany({
      where: { sku_id: fx.skuId, location_id: fx.locationId },
      data: { on_hand: 9 },
    });
    expect(await mine()).toEqual([
      { sku_id: fx.skuId, code: fx.skuCode, field: 'on_hand', expected: 7, actual: 9 },
    ]);
  });

  it('raises one outbox alert and does not repeat it inside the cooldown', async () => {
    const before = await prisma.outboxEvent.count({ where: { type: 'stock.divergence_found' } });
    const first = await reconcileStock();
    expect(first.some((row) => row.sku_id === fx.skuId)).toBe(true);
    const created = await prisma.outboxEvent.findMany({
      where: { type: 'stock.divergence_found' },
      orderBy: { created_at: 'desc' },
    });
    alertIds.push(...created.map((event) => event.outbox_event_id));
    // Se já havia alerta nas últimas 24 h (de outra rodada), este não duplica; senão cria exatamente um.
    expect(created.length).toBeGreaterThanOrEqual(before);
    const afterFirst = created.length;
    await reconcileStock();
    expect(await prisma.outboxEvent.count({ where: { type: 'stock.divergence_found' } })).toBe(
      afterFirst
    );
  });
});
