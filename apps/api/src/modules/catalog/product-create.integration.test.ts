import { ensureAttributeCatalog, prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { createProduct, listProducts } from './product.service';

const sku = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
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

describe('product creation with code, price and initial stock (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;

  beforeAll(async () => {
    await ensureAttributeCatalog(prisma);
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await prisma.skuAttributeValue.deleteMany({
      where: { sku: { product: { category_id: fx.categoryId } } },
    });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  const body = (code: string, skus: ReturnType<typeof sku>[], slugSuffix = '') => ({
    category_id: fx.categoryId,
    code,
    name: `Produto ${code}`,
    slug: `produto-${code}${slugSuffix}`.toLowerCase(),
    description: null,
    brand_id: null,
    status: 'draft' as const,
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    skus,
  });

  it('saves the site price and the opening stock of every SKU in the same transaction', async () => {
    const code = `GRD-${fx.suffix.toUpperCase()}`;
    const created = await createProduct(
      fx.userId,
      body(code, [
        sku(`${code}-PT-M`, {
          attributes: { cor: 'preto', tamanho: 'm' },
          price_cents: 8990,
          initial_stock: 5,
        }),
        sku(`${code}-PT-G`, {
          attributes: { cor: 'preto', tamanho: 'g' },
          price_cents: 8990,
          initial_stock: 0,
        }),
        sku(`${code}-BC-M`, { attributes: { cor: 'branco', tamanho: 'm' } }),
      ])
    );
    expect(created.code).toBe(code);

    const rows = await prisma.sku.findMany({
      where: { product_id: created.product_id },
      include: { prices: true, stock_levels: true, movements: true },
      orderBy: { code: 'asc' },
    });
    const byCode = Object.fromEntries(rows.map((row) => [row.code.slice(-4), row]));
    expect(byCode['PT-M']?.prices.map((p) => p.price_cents)).toEqual([8990]);
    expect(byCode['PT-M']?.stock_levels[0]).toMatchObject({ on_hand: 5, reserved: 0 });
    expect(byCode['PT-M']?.movements[0]).toMatchObject({ type: 'inbound', quantity: 5 });
    // Estoque 0 não cria movimentação; sem preço informado, nenhum preço é gravado.
    expect(byCode['PT-G']?.movements).toHaveLength(0);
    expect(byCode['BC-M']?.prices).toHaveLength(0);

    // Preço e saldo aparecem na listagem (a mesma conta usada pelas telas).
    const listed = (await listProducts({ page: 1, page_size: 20, q: code })).data[0];
    expect(listed).toMatchObject({ price_min_cents: 8990, available: 5, sku_count: 3 });
  });

  it('refuses a repeated product code and finds a product by its code', async () => {
    const code = `UNQ-${fx.suffix.toUpperCase()}`;
    await createProduct(fx.userId, body(code, [sku(`${code}-1`)]));
    await expect(
      createProduct(fx.userId, body(code, [sku(`${code}-2`)], '-outro'))
    ).rejects.toThrow(/código/);
    const found = await listProducts({ page: 1, page_size: 20, q: code.toLowerCase() });
    expect(found.data.map((p) => p.code)).toEqual([code]);
  });
});
