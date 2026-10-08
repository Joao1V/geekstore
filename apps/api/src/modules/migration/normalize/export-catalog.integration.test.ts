import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../../test-support/fixtures';
import { exportCatalog } from './export-catalog';

describe('exportCatalog (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let collectionId: string;
  const now = new Date('2026-10-08T12:00:00Z');
  const scope = () => ({ category_id: fx.categoryId });

  beforeAll(async () => {
    fx = await createCatalogFixture();
    collectionId = (
      await prisma.collection.create({
        data: { name: `Franq ${fx.suffix}`, slug: `franq-${fx.suffix}`, kind: 'franchise' },
      })
    ).collection_id;
  });

  afterAll(async () => {
    await prisma.collectionProduct.deleteMany({ where: { collection_id: collectionId } });
    await prisma.collection.delete({ where: { collection_id: collectionId } });
    await prisma.media.deleteMany({ where: { product_id: fx.productId } });
    await prisma.price.deleteMany({ where: { sku: { product_id: fx.productId } } });
    await prisma.stockLevel.deleteMany({ where: { sku: { product_id: fx.productId } } });
    await prisma.sku.updateMany({
      where: { product_id: fx.productId },
      data: { merged_into_sku_id: null },
    });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('leaves out a product whose SKUs have no price (nothing sellable to export)', async () => {
    const catalog = await exportCatalog(now, scope());
    expect(catalog.products).toHaveLength(0);
  });

  it('exports price, stock, photos and franchises, and skips merged SKUs and archived products', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    await prisma.price.create({
      data: {
        sku_id: fx.skuId,
        channel_id: channel.channel_id,
        price_cents: 1990,
        starts_at: new Date('2000-01-01T00:00:00Z'),
      },
    });
    await prisma.stockLevel.create({
      data: { sku_id: fx.skuId, location_id: fx.locationId, on_hand: 7, reserved: 0 },
    });
    await prisma.media.create({
      data: { product_id: fx.productId, url: 'https://exemplo.test/a.jpg', alt: 'a', position: 0 },
    });
    await prisma.collectionProduct.create({
      data: { collection_id: collectionId, product_id: fx.productId, position: 0 },
    });
    const merged = await prisma.sku.create({
      data: { product_id: fx.productId, code: `${fx.skuCode}-X`, merged_into_sku_id: fx.skuId },
    });
    await prisma.product.create({
      data: {
        category_id: fx.categoryId,
        code: `ARQ-${fx.suffix}`,
        name: 'Arquivado',
        slug: `arquivado-${fx.suffix}`,
        status: 'archived',
      },
    });

    const catalog = await exportCatalog(now, scope());

    expect(catalog.products).toHaveLength(1);
    const [product] = catalog.products;
    expect(product).toMatchObject({
      name: `IT Produto ${fx.suffix}`,
      photos: ['https://exemplo.test/a.jpg'],
      collections: [`franq-${fx.suffix}`],
      has_variants: false,
    });
    expect(product?.skus.map((sku) => sku.code)).toEqual([fx.skuCode]);
    expect(product?.skus[0]).toMatchObject({ price_cents: 1990, stock: 7, promo: null });
    expect(product?.skus.some((sku) => sku.code === merged.code)).toBe(false);
    expect(catalog.collections).toEqual([
      { slug: `franq-${fx.suffix}`, name: `Franq ${fx.suffix}` },
    ]);
  });
});
