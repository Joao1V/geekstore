import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { bulkSetSitePrices, listCurrentPrices } from './pricing.service';

describe('pricing.service (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;

  beforeAll(async () => {
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('bulk edit creates a new price record per change and keeps the history', async () => {
    expect(
      await bulkSetSitePrices(fx.userId, { items: [{ sku_id: fx.skuId, price_cents: 1990 }] })
    ).toBe(1);
    // mesmo valor: nada novo
    expect(
      await bulkSetSitePrices(fx.userId, { items: [{ sku_id: fx.skuId, price_cents: 1990 }] })
    ).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 5)); // starts_at distinto (ms)
    expect(
      await bulkSetSitePrices(fx.userId, { items: [{ sku_id: fx.skuId, price_cents: 2490 }] })
    ).toBe(1);

    const history = await prisma.price.findMany({
      where: { sku_id: fx.skuId },
      orderBy: { starts_at: 'asc' },
    });
    expect(history.map((row) => row.price_cents)).toEqual([1990, 2490]);
    expect(Number.isInteger(history[0]?.price_cents)).toBe(true);

    const current = await listCurrentPrices(fx.skuId);
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ channel_code: 'site', price_cents: 2490 });

    const audits = await prisma.auditLog.count({
      where: { entity: 'price', entity_id: { in: history.map((row) => row.price_id) } },
    });
    expect(audits).toBe(2);
  });

  it('rejects unknown and duplicated SKUs without writing anything', async () => {
    const before = await prisma.price.count({ where: { sku_id: fx.skuId } });

    await expect(
      bulkSetSitePrices(fx.userId, {
        items: [
          { sku_id: fx.skuId, price_cents: 100 },
          { sku_id: crypto.randomUUID(), price_cents: 100 },
        ],
      })
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      bulkSetSitePrices(fx.userId, {
        items: [
          { sku_id: fx.skuId, price_cents: 100 },
          { sku_id: fx.skuId, price_cents: 200 },
        ],
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(await prisma.price.count({ where: { sku_id: fx.skuId } })).toBe(before);
  });
});
