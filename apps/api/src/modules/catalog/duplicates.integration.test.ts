import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type CatalogFixture,
  createCatalogFixture,
  findWarehouseId,
} from '../../test-support/fixtures';
import {
  dismissDuplicates,
  getDuplicateSummary,
  groupKeyOf,
  listAllDuplicateGroups,
  mergeCertainDuplicates,
  mergeSkus,
} from './duplicates.service';

describe('duplicates (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let warehouseId: string;
  let siteChannelId: string;
  let seq = 0;
  const dismissedKeys: string[] = [];

  /** Produto simples com 1 SKU, já com preço, saldo e (opcional) foto. */
  async function simple(options: {
    name: string;
    ean?: string | null;
    price?: number;
    stock?: number;
    reserved?: number;
    photo?: boolean;
    legacy?: string;
  }) {
    seq += 1;
    const tag = `${fx.suffix.toUpperCase()}${seq}`;
    const product = await prisma.product.create({
      data: {
        code: `DUP-${tag}`,
        name: options.name,
        slug: `dup-${fx.suffix}-${seq}`,
        category_id: fx.categoryId,
        status: 'active',
      },
    });
    const sku = await prisma.sku.create({
      data: {
        product_id: product.product_id,
        code: `DUP-${tag}-S`,
        ean: options.ean === undefined ? null : options.ean,
        legacy_code: options.legacy ?? null,
      },
    });
    if (options.price !== undefined) {
      await prisma.price.create({
        data: {
          sku_id: sku.sku_id,
          channel_id: siteChannelId,
          price_cents: options.price,
          starts_at: new Date(Date.now() - 60_000),
        },
      });
    }
    await prisma.stockLevel.create({
      data: {
        sku_id: sku.sku_id,
        location_id: warehouseId,
        on_hand: options.stock ?? 0,
        reserved: options.reserved ?? 0,
      },
    });
    if (options.photo) {
      await prisma.media.create({
        data: {
          product_id: product.product_id,
          url: `https://cdn.exemplo.com/${tag}.jpg`,
          alt: tag,
          position: 0,
        },
      });
    }
    return { product, sku };
  }

  const groupOf = async (...skuIds: string[]) => {
    const key = groupKeyOf(skuIds);
    return (await listAllDuplicateGroups()).find((group) => group.key === key);
  };

  beforeAll(async () => {
    fx = await createCatalogFixture();
    warehouseId = await findWarehouseId();
    siteChannelId = (await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } }))
      .channel_id;
  });

  afterAll(async () => {
    await prisma.duplicateDismissal.deleteMany({ where: { group_key: { in: dismissedKeys } } });
    await prisma.stockMovement.deleteMany({
      where: { sku: { product: { category_id: fx.categoryId } } },
    });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('ignores accents, punctuation and the "#code" when comparing names, and grades the confidence', async () => {
    const name = `Álbum Copa Teste ${fx.suffix}`;
    const a = await simple({ name, ean: '7890000000011', price: 7490, stock: 3 });
    const b = await simple({
      name: `ALBUM COPA TESTE ${fx.suffix} #22`,
      ean: '7890000000011',
      price: 7490,
      stock: 4,
    });
    const certain = await groupOf(a.sku.sku_id, b.sku.sku_id);
    expect(certain?.level).toBe('certain');
    expect(certain?.reasons).toContain('mesmo EAN');
    expect(certain?.total_stock).toBe(7);

    const likelyName = `Bala Teste ${fx.suffix}`;
    const c = await simple({ name: likelyName, ean: '7890000000028', price: 1990, stock: 1 });
    const d = await simple({ name: likelyName, ean: '7890000000028', price: 1690, stock: 1 });
    expect((await groupOf(c.sku.sku_id, d.sku.sku_id))?.level).toBe('likely');

    const reviewName = `Almofada Teste ${fx.suffix}`;
    const e = await simple({ name: reviewName, ean: '7890000000035', price: 6990, stock: 1 });
    const f = await simple({ name: reviewName, ean: '7890000000042', price: 9990, stock: 1 });
    expect((await groupOf(e.sku.sku_id, f.sku.sku_id))?.level).toBe('review');
  });

  it('does NOT group products that merely share an EAN (series barcodes are common in the ERP)', async () => {
    const a = await simple({
      name: `Hot Wheels Alfa ${fx.suffix}`,
      ean: '7890000000059',
      price: 1990,
      stock: 1,
    });
    const b = await simple({
      name: `Hot Wheels Beta ${fx.suffix}`,
      ean: '7890000000059',
      price: 1990,
      stock: 1,
    });
    expect(await groupOf(a.sku.sku_id, b.sku.sku_id)).toBeUndefined();
  });

  it('merges: moves the stock through the ledger, archives the duplicate and keeps its ERP code', async () => {
    const name = `Pelúcia Merge ${fx.suffix}`;
    const keep = await simple({
      name,
      ean: '7890000000066',
      price: 5000,
      stock: 3,
      photo: true,
      legacy: `K${fx.suffix}`,
    });
    const dup = await simple({
      name,
      ean: '7890000000066',
      price: 5000,
      stock: 4,
      legacy: `D${fx.suffix}`,
    });

    const result = await mergeSkus(fx.userId, {
      survivor_sku_id: keep.sku.sku_id,
      duplicate_sku_ids: [dup.sku.sku_id],
    });
    expect(result).toEqual({ skus_archived: 1, units_moved: 4 });

    const survivorLevel = await prisma.stockLevel.findFirstOrThrow({
      where: { sku_id: keep.sku.sku_id },
    });
    const duplicateLevel = await prisma.stockLevel.findFirstOrThrow({
      where: { sku_id: dup.sku.sku_id },
    });
    expect(survivorLevel.on_hand).toBe(7);
    expect(duplicateLevel.on_hand).toBe(0);

    const movements = await prisma.stockMovement.findMany({
      where: { reference_type: 'sku_merge', sku_id: { in: [keep.sku.sku_id, dup.sku.sku_id] } },
      orderBy: { quantity: 'asc' },
    });
    expect(movements.map((m) => [m.type, m.quantity])).toEqual([
      ['outbound', -4],
      ['inbound', 4],
    ]);

    const archived = await prisma.sku.findUniqueOrThrow({
      where: { sku_id: dup.sku.sku_id },
      include: { product: true },
    });
    expect(archived).toMatchObject({
      status: 'inactive',
      merged_into_sku_id: keep.sku.sku_id,
      legacy_code: `D${fx.suffix}`,
    });
    expect(archived.product.status).toBe('archived');

    // Já mesclado: some da lista e não pode ser mesclado de novo.
    expect(await groupOf(keep.sku.sku_id, dup.sku.sku_id)).toBeUndefined();
    await expect(
      mergeSkus(fx.userId, {
        survivor_sku_id: keep.sku.sku_id,
        duplicate_sku_ids: [dup.sku.sku_id],
      })
    ).rejects.toThrow(/já foi mesclado/);
  });

  it('reuses the duplicate photo when the surviving product has none', async () => {
    const name = `Caneca Foto ${fx.suffix}`;
    const keep = await simple({ name, price: 3000, stock: 1 });
    const dup = await simple({ name, price: 3000, stock: 1, photo: true });
    await mergeSkus(fx.userId, {
      survivor_sku_id: keep.sku.sku_id,
      duplicate_sku_ids: [dup.sku.sku_id],
    });
    expect(await prisma.media.count({ where: { product_id: keep.product.product_id } })).toBe(1);
  });

  it('refuses when the duplicate has reserved units and changes nothing (all or nothing)', async () => {
    const name = `Funko Reserva ${fx.suffix}`;
    const keep = await simple({ name, price: 9000, stock: 5 });
    const dup = await simple({ name, price: 9000, stock: 2, reserved: 1 });
    await expect(
      mergeSkus(fx.userId, {
        survivor_sku_id: keep.sku.sku_id,
        duplicate_sku_ids: [dup.sku.sku_id],
      })
    ).rejects.toThrow(/reservada/);
    expect(
      (await prisma.stockLevel.findFirstOrThrow({ where: { sku_id: keep.sku.sku_id } })).on_hand
    ).toBe(5);
    expect(
      (await prisma.stockLevel.findFirstOrThrow({ where: { sku_id: dup.sku.sku_id } })).on_hand
    ).toBe(2);
    expect(
      (await prisma.sku.findUniqueOrThrow({ where: { sku_id: dup.sku.sku_id } })).merged_into_sku_id
    ).toBeNull();
  });

  it('only merges simple products, never one that has variants', async () => {
    const name = `Camiseta Var ${fx.suffix}`;
    const keep = await simple({ name, price: 8000, stock: 1 });
    const withVariants = await simple({ name, price: 8000, stock: 1 });
    await prisma.sku.create({
      data: { product_id: withVariants.product.product_id, code: `DUP-VAR-${fx.suffix}` },
    });
    await expect(
      mergeSkus(fx.userId, {
        survivor_sku_id: keep.sku.sku_id,
        duplicate_sku_ids: [withVariants.sku.sku_id],
      })
    ).rejects.toThrow(/variações/);
  });

  it('"são diferentes" hides the group until a new item joins it', async () => {
    const name = `Chaveiro Dif ${fx.suffix}`;
    const a = await simple({ name, price: 1500, stock: 1 });
    const b = await simple({ name, price: 1500, stock: 1 });
    expect(await groupOf(a.sku.sku_id, b.sku.sku_id)).toBeDefined();

    await dismissDuplicates(fx.userId, [a.sku.sku_id, b.sku.sku_id]);
    dismissedKeys.push(groupKeyOf([a.sku.sku_id, b.sku.sku_id]));
    expect(await groupOf(a.sku.sku_id, b.sku.sku_id)).toBeUndefined();

    const c = await simple({ name, price: 1500, stock: 1 });
    expect(await groupOf(a.sku.sku_id, b.sku.sku_id, c.sku.sku_id)).toBeDefined();
  });

  it('bulk "certain" merge: a dry run changes nothing; the real run merges only the asked group', async () => {
    const name = `Álbum Lote ${fx.suffix}`;
    const a = await simple({ name, ean: '7890000000073', price: 6000, stock: 2, photo: true });
    const b = await simple({ name, ean: '7890000000073', price: 6000, stock: 5 });
    const group = await groupOf(a.sku.sku_id, b.sku.sku_id);
    const only = new Set([group?.key ?? '']);

    const preview = await mergeCertainDuplicates(fx.userId, true, only);
    expect(preview).toMatchObject({ groups: 1, skus_archived: 1, units_moved: 5, dry_run: true });
    expect(
      (await prisma.sku.findUniqueOrThrow({ where: { sku_id: b.sku.sku_id } })).merged_into_sku_id
    ).toBeNull();

    const done = await mergeCertainDuplicates(fx.userId, false, only);
    expect(done).toMatchObject({
      groups: 1,
      skus_archived: 1,
      units_moved: 5,
      dry_run: false,
      skipped: [],
    });
    // Fica o que tem foto; o estoque soma.
    expect(
      (await prisma.sku.findUniqueOrThrow({ where: { sku_id: b.sku.sku_id } })).merged_into_sku_id
    ).toBe(a.sku.sku_id);
    expect(
      (await prisma.stockLevel.findFirstOrThrow({ where: { sku_id: a.sku.sku_id } })).on_hand
    ).toBe(7);
  });

  it('summarises the groups by level', async () => {
    const summary = await getDuplicateSummary();
    expect(summary.certain + summary.likely + summary.review).toBeGreaterThanOrEqual(3);
  });
});
