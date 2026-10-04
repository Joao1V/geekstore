import { ensureAttributeCatalog, prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { createProduct } from './product.service';
import { createSku } from './sku.service';

const skuBody = (extra: Record<string, unknown> = {}) => ({
  ean: null,
  ncm: null,
  manufacturer_code: null,
  weight_g: null,
  length_mm: null,
  width_mm: null,
  height_mm: null,
  cost_cents: null,
  status: 'active' as const,
  attributes: {},
  price_cents: null,
  initial_stock: null,
  ...extra,
});

describe('automatic product and SKU codes (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let sequenceBefore: number | null = null;

  beforeAll(async () => {
    await ensureAttributeCatalog(prisma);
    fx = await createCatalogFixture();
    // A categoria do fixture está fora da taxonomia, então o tipo é GEN.
    sequenceBefore =
      (await prisma.skuSequence.findUnique({ where: { prefix: 'GEN' } }))?.last_value ?? null;
  });

  afterAll(async () => {
    await prisma.skuAttributeValue.deleteMany({
      where: { sku: { product: { category_id: fx.categoryId } } },
    });
    await fx.cleanup();
    // O teste consome números reais do contador; devolve ao que era.
    if (sequenceBefore === null) await prisma.skuSequence.deleteMany({ where: { prefix: 'GEN' } });
    else {
      await prisma.skuSequence.update({
        where: { prefix: 'GEN' },
        data: { last_value: sequenceBefore },
      });
    }
    await prisma.$disconnect();
  });

  const body = (n: number, skus: ReturnType<typeof skuBody>[]) => ({
    category_id: fx.categoryId,
    name: `Produto automático ${n}`,
    slug: `produto-automatico-${fx.suffix}-${n}`.toLowerCase(),
    description: null,
    brand_id: null,
    status: 'draft' as const,
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    skus,
  });

  it('numbers the product and builds the SKU codes from the variation suffixes', async () => {
    const created = await createProduct(
      fx.userId,
      body(1, [
        skuBody({ attributes: { cor: 'preto', tamanho: 'm' } }),
        skuBody({ attributes: { cor: 'branco', tamanho: 'g' } }),
      ])
    );
    expect(created.code).toMatch(/^GEN-\d{5}$/);
    expect(created.skus.map((sku) => sku.code).sort()).toEqual([
      `${created.code}-BC-G`,
      `${created.code}-PT-M`,
    ]);
  });

  it('gives a simple product the base code as its SKU', async () => {
    const created = await createProduct(fx.userId, body(2, [skuBody()]));
    expect(created.skus[0]?.code).toBe(created.code);
  });

  it('never repeats a number when products are created at the same time', async () => {
    const created = await Promise.all(
      [3, 4, 5, 6, 7].map((n) => createProduct(fx.userId, body(n, [skuBody()])))
    );
    const codes = created.map((product) => product.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps a code typed by hand and derives the SKU codes from it', async () => {
    const code = `MAN-${fx.suffix.toUpperCase()}`;
    const created = await createProduct(fx.userId, {
      ...body(8, [skuBody({ attributes: { cor: 'preto' } })]),
      code,
    });
    expect(created.code).toBe(code);
    expect(created.skus[0]?.code).toBe(`${code}-PT`);
  });

  it('adds a SKU to an existing product with the code derived from the product', async () => {
    const product = await createProduct(
      fx.userId,
      body(9, [skuBody({ attributes: { cor: 'preto' } })])
    );
    const added = await createSku(
      fx.userId,
      product.product_id,
      skuBody({ attributes: { cor: 'azul' } })
    );
    expect(added.code).toBe(`${product.code}-AZ`);
  });
});
