import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type CatalogFixture,
  createCatalogFixture,
  findWarehouseId,
} from '../../test-support/fixtures';
import { listProducts } from './product.service';
import { getProductSummary } from './product-summary';

const query = { page: 1, page_size: 50 };

describe('product list numbers and shortcuts (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let withVariants: string; // 2 SKUs com preço e saldo, com foto
  let soldOut: string; // 1 SKU sem saldo e sem foto
  let siteChannelId: string;

  async function createProduct(
    name: string,
    skus: { code: string; price?: number; stock: number }[]
  ) {
    const warehouseId = await findWarehouseId();
    const product = await prisma.product.create({
      data: {
        code: `PL-${name.replace(/\W/g, '').slice(0, 8).toUpperCase()}-${fx.suffix.toUpperCase()}`,
        name,
        slug: `${name}-${fx.suffix}`.toLowerCase(),
        category_id: fx.categoryId,
        status: 'active',
      },
    });
    for (const sku of skus) {
      const created = await prisma.sku.create({
        data: { product_id: product.product_id, code: sku.code },
      });
      if (sku.price !== undefined) {
        await prisma.price.create({
          data: {
            sku_id: created.sku_id,
            channel_id: siteChannelId,
            price_cents: sku.price,
            starts_at: new Date(Date.now() - 60_000),
          },
        });
      }
      await prisma.stockLevel.create({
        data: { sku_id: created.sku_id, location_id: warehouseId, on_hand: sku.stock, reserved: 0 },
      });
    }
    return product.product_id;
  }

  beforeAll(async () => {
    fx = await createCatalogFixture();
    siteChannelId = (await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } }))
      .channel_id;
    withVariants = await createProduct('Com variacoes', [
      { code: `B-${fx.suffix}`, price: 2500, stock: 2 },
      { code: `A-${fx.suffix}`, price: 1000, stock: 3 },
    ]);
    soldOut = await createProduct('Esgotado', [{ code: `S-${fx.suffix}`, price: 500, stock: 0 }]);
    await prisma.media.create({
      data: {
        product_id: withVariants,
        url: 'https://cdn.exemplo.com/v.jpg',
        alt: 'v',
        position: 0,
      },
    });
  });

  afterAll(async () => {
    const products = [withVariants, soldOut];
    const skus = await prisma.sku.findMany({
      where: { product_id: { in: products } },
      select: { sku_id: true },
    });
    const skuIds = skus.map((sku) => sku.sku_id);
    await prisma.price.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.stockLevel.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.sku.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.product.deleteMany({ where: { product_id: { in: products } } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  const inCategory = async (
    extra: Parameters<typeof listProducts>[0] extends infer Q ? Partial<Q> : never = {}
  ) => (await listProducts({ ...query, category_id: fx.categoryId, ...extra })).data;

  it('aggregates SKU codes, price range and available stock per product', async () => {
    const item = (await inCategory()).find((p) => p.product_id === withVariants);
    expect(item).toMatchObject({
      sku_count: 2,
      sku_codes: [`A-${fx.suffix}`, `B-${fx.suffix}`], // em ordem alfabética
      price_min_cents: 1000,
      price_max_cents: 2500,
      available: 5,
    });
  });

  it('reports a product with no SKU data as empty, not as an error', async () => {
    const item = (await inCategory()).find((p) => p.product_id === fx.productId);
    expect(item).toMatchObject({
      sku_count: 1,
      price_min_cents: null,
      price_max_cents: null,
      available: 0,
    });
  });

  it('filters "out_of_stock" and "no_photo" and keeps the numbers', async () => {
    const out = await inCategory({ issue: 'out_of_stock' });
    expect(out.map((p) => p.product_id).sort()).toEqual([fx.productId, soldOut].sort());
    expect(out.find((p) => p.product_id === soldOut)).toMatchObject({
      available: 0,
      price_min_cents: 500,
    });

    const noPhoto = await inCategory({ issue: 'no_photo' });
    const ids = noPhoto.map((p) => p.product_id);
    expect(ids).toContain(soldOut);
    expect(ids).not.toContain(withVariants);
  });

  it('combines a shortcut with the accent-insensitive search', async () => {
    const found = await inCategory({ issue: 'out_of_stock', q: 'ESGOTADO' });
    expect(found.map((p) => p.product_id)).toEqual([soldOut]);
  });

  it('summary totals are consistent and see our products', async () => {
    const summary = await getProductSummary();
    expect(summary.total).toBe(summary.active + summary.draft + summary.archived);
    // Limites inferiores: o banco pode ter o catálogo real e outros testes rodando em paralelo.
    expect(summary.out_of_stock).toBeGreaterThanOrEqual(2);
    expect(summary.no_photo).toBeGreaterThanOrEqual(2);
    expect(summary.total).toBeGreaterThanOrEqual(3);
  });
});
