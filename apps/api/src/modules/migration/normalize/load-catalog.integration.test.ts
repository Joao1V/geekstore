import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reconcileStock } from '../../stock/stock-reconcile.service';
import type { NormalizedCatalog, NormalizedSku } from './catalog-file';
import { importCatalog, lastNumbersOf } from './load-catalog';

const NOW = new Date('2026-10-04T12:00:00Z');
const run = randomUUID().slice(0, 8);
// Número alto e aleatório: não esbarra no que já existe no banco de desenvolvimento.
const first = randomInt(800_000, 899_000);
const code = (n: number) => `CNC-${first + n}`;

const sku = (suffix: string, overrides: Partial<NormalizedSku> = {}): NormalizedSku => ({
  code: suffix,
  ean: null,
  manufacturer_code: null,
  ncm: null,
  weight_g: null,
  length_mm: null,
  width_mm: null,
  height_mm: null,
  price_cents: 4990,
  promo: null,
  stock: 3,
  status: 'active',
  attributes: {},
  photos: [`https://cdn.exemplo.com/${run}/${suffix}.jpg`],
  ...overrides,
});

const catalog: NormalizedCatalog = {
  format: 1,
  generated_at: NOW.toISOString(),
  source_sha256: `teste-${run}`,
  scope: ['canecas'],
  products: [
    {
      code: code(1),
      name: `Caneca Teste ${run}`,
      slug: `caneca-teste-${run}`,
      description: null,
      category: 'canecas',
      brand: `Marca Teste ${run}`,
      collections: ['disney'],
      status: 'active',
      has_variants: true,
      photos: [],
      skus: [
        sku(`${code(1)}-PT`, {
          attributes: { cor: 'Preto' },
          photos: [`https://cdn.exemplo.com/${run}/pt.jpg`],
          price_cents: 9990,
          promo: { price_cents: 8490, compare_at_cents: 9990, starts_at: null, ends_at: null },
        }),
        sku(`${code(1)}-BC`, {
          attributes: { cor: 'Branco' },
          photos: [`https://cdn.exemplo.com/${run}/bc.jpg`],
        }),
      ],
    },
    {
      code: code(2),
      name: `Caneca Simples ${run}`,
      slug: `caneca-simples-${run}`,
      description: null,
      category: 'canecas',
      brand: null,
      collections: [],
      status: 'active',
      has_variants: false,
      photos: [`https://cdn.exemplo.com/${run}/s.jpg`],
      skus: [sku(code(2), { stock: 0, status: 'inactive' })],
    },
  ],
};
const skuCodes = catalog.products.flatMap((product) => product.skus.map((s) => s.code));

let sequenceBefore: number | null = null;

beforeAll(async () => {
  sequenceBefore =
    (await prisma.skuSequence.findUnique({ where: { prefix: 'CNC' } }))?.last_value ?? null;
});

afterAll(async () => {
  // O teste usa números altos de propósito; devolve o contador ao que era.
  if (sequenceBefore === null) await prisma.skuSequence.deleteMany({ where: { prefix: 'CNC' } });
  else
    await prisma.skuSequence.update({
      where: { prefix: 'CNC' },
      data: { last_value: sequenceBefore },
    });
  const skus = await prisma.sku.findMany({
    where: { code: { in: skuCodes } },
    select: { sku_id: true, product_id: true },
  });
  const skuIds = skus.map((s) => s.sku_id);
  const productIds = skus.map((s) => s.product_id);
  await prisma.collectionProduct.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.media.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.price.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockMovement.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockLevel.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.skuAttributeValue.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.sku.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.product.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.brand.deleteMany({ where: { name: `Marca Teste ${run}` } });
  await prisma.auditLog.deleteMany({
    where: {
      entity: 'catalog_import',
      after: { path: ['source_sha256'], equals: catalog.source_sha256 },
    },
  });
  await prisma.$disconnect();
});

describe('importCatalog (integration — requires a live DATABASE_URL)', () => {
  it('imports products, SKUs, photos per variation and the franchise collection', async () => {
    const result = await importCatalog(catalog, NOW);
    expect(result.inserted.products).toBe(2);
    expect(result.inserted.skus).toBe(3);

    const imported = await prisma.sku.findMany({
      where: { code: { in: skuCodes } },
      include: {
        media: true,
        product: { include: { collection_products: { include: { collection: true } } } },
      },
      orderBy: { code: 'asc' },
    });
    expect(imported.map((s) => s.code)).toEqual([...skuCodes].sort());
    expect(imported.every((s) => s.legacy_code === null)).toBe(true);
    const black = imported.find((s) => s.code.endsWith('-PT'));
    expect(black?.media.map((m) => m.url)).toEqual([`https://cdn.exemplo.com/${run}/pt.jpg`]);
    expect(black?.product.collection_products.map((c) => c.collection.slug)).toEqual(['disney']);
    const simple = imported.find((s) => s.code === code(2));
    expect(simple?.status).toBe('inactive');
  });

  it('stores the attributes, the base price and the promotion, and links the brand', async () => {
    const black = await prisma.sku.findFirstOrThrow({
      where: { code: `${code(1)}-PT` },
      include: {
        attribute_values: { include: { value: true, attribute: true } },
        prices: true,
        product: { include: { brand: true } },
      },
    });
    expect(black.attribute_values.map((row) => [row.attribute.code, row.value.code])).toEqual([
      ['cor', 'preto'],
    ]);
    expect(black.product.brand?.name).toBe(`Marca Teste ${run}`);
    const [base, promo] = [...black.prices].sort(
      (a, b) => a.starts_at.getTime() - b.starts_at.getTime()
    );
    expect(base).toMatchObject({ price_cents: 9990, compare_at_cents: null });
    expect(promo).toMatchObject({ price_cents: 8490, compare_at_cents: 9990 });
  });

  it('keeps the stock ledger consistent with the balances', async () => {
    const ours = (
      await prisma.sku.findMany({ where: { code: { in: skuCodes } }, select: { sku_id: true } })
    ).map((sku) => sku.sku_id);
    const { divergences } = await reconcileStock();
    expect(divergences.filter((d) => ours.includes(d.sku_id))).toEqual([]);
    const levels = await prisma.stockLevel.aggregate({
      where: { sku_id: { in: ours } },
      _sum: { on_hand: true },
    });
    const movements = await prisma.stockMovement.aggregate({
      where: { sku_id: { in: ours } },
      _sum: { quantity: true },
    });
    expect(movements._sum.quantity).toBe(levels._sum.on_hand);
    expect(levels._sum.on_hand).toBe(6); // 3 + 3; o terceiro SKU entra com saldo 0
  });

  it('is safe to run again: nothing is duplicated', async () => {
    const again = await importCatalog(catalog, NOW);
    expect(again.inserted.skus).toBe(0);
    expect(again.alreadyImported).toBeGreaterThanOrEqual(2);
    expect(await prisma.sku.count({ where: { code: { in: skuCodes } } })).toBe(3);
  });

  it('advances the sequence for the type without ever going back', async () => {
    const before = await prisma.skuSequence.findUnique({ where: { prefix: 'CNC' } });
    expect(before?.last_value).toBeGreaterThanOrEqual(first + 2);
    await importCatalog({ ...catalog, products: [] }, NOW);
    const after = await prisma.skuSequence.findUnique({ where: { prefix: 'CNC' } });
    expect(after?.last_value).toBe(before?.last_value);
  });

  it('refuses a new product that reuses a SKU code already in the database', async () => {
    const clash: NormalizedCatalog = {
      ...catalog,
      products: [
        {
          ...catalog.products[1]!,
          code: code(3),
          slug: `caneca-outra-${run}`,
          skus: [sku(code(2))],
        },
      ],
    };
    await expect(importCatalog(clash, NOW)).rejects.toThrow();
    expect(await prisma.product.count({ where: { code: code(3) } })).toBe(0);
  });

  it('reads the highest number per type from the file', () => {
    expect(lastNumbersOf(catalog)).toEqual({ CNC: first + 2 });
  });
});
