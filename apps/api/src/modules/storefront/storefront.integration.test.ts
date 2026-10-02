import { ensureAttributeCatalog, prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import {
  type CatalogFixture,
  createCatalogFixture,
  findWarehouseId,
} from '../../test-support/fixtures';

describe('storefront (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let brandSlug: string;
  let categorySlug: string;
  const ids: Record<string, string> = {};

  const get = async (url: string) => {
    const response = await app.inject({ method: 'GET', url });
    return { status: response.statusCode, body: response.json() };
  };

  async function createProduct(
    key: string,
    options: {
      name: string;
      status?: 'active' | 'draft';
      skus: {
        code: string;
        price?: number;
        compareAt?: number;
        stock?: number;
        attributes?: Record<string, string>;
      }[];
      photo?: boolean;
      brandId?: string;
    }
  ) {
    const warehouseId = await findWarehouseId();
    const site = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    const product = await prisma.product.create({
      data: {
        code: `ST-${key}-${fx.suffix.toUpperCase()}`,
        name: options.name,
        slug: `st-${key}-${fx.suffix}`,
        category_id: fx.categoryId,
        brand_id: options.brandId,
        status: options.status ?? 'active',
      },
    });
    ids[key] = product.product_id;
    if (options.photo) {
      await prisma.media.create({
        data: {
          product_id: product.product_id,
          url: `https://cdn.exemplo.com/${key}.jpg`,
          alt: key,
          position: 0,
        },
      });
    }
    for (const sku of options.skus) {
      const row = await prisma.sku.create({
        data: { product_id: product.product_id, code: `${sku.code}-${fx.suffix.toUpperCase()}` },
      });
      if (sku.price !== undefined) {
        await prisma.price.create({
          data: {
            sku_id: row.sku_id,
            channel_id: site.channel_id,
            price_cents: sku.price,
            compare_at_cents: sku.compareAt ?? null,
            starts_at: new Date(Date.now() - 60_000),
          },
        });
      }
      if (sku.stock) {
        await prisma.stockLevel.create({
          data: { sku_id: row.sku_id, location_id: warehouseId, on_hand: sku.stock, reserved: 0 },
        });
      }
      for (const [attribute, value] of Object.entries(sku.attributes ?? {})) {
        const def = await prisma.attributeValue.findFirstOrThrow({
          where: { code: value, attribute: { code: attribute } },
        });
        await prisma.skuAttributeValue.create({
          data: {
            sku_id: row.sku_id,
            attribute_id: def.attribute_id,
            attribute_value_id: def.attribute_value_id,
          },
        });
      }
    }
  }

  beforeAll(async () => {
    await ensureAttributeCatalog(prisma);
    app = await buildTestApp();
    fx = await createCatalogFixture();
    categorySlug = `it-cat-${fx.suffix}`;
    brandSlug = `marca-${fx.suffix}`;
    const brand = await prisma.brand.create({
      data: { name: `Marca ${fx.suffix}`, slug: brandSlug },
    });

    await createProduct('camiseta', {
      name: `Camiseta R.P.G Dourada ${fx.suffix}`,
      photo: true,
      brandId: brand.brand_id,
      skus: [
        {
          code: 'CAM-PT-M',
          price: 8990,
          compareAt: 11990,
          stock: 3,
          attributes: { cor: 'preto', tamanho: 'm' },
        },
        { code: 'CAM-PT-G', price: 9990, stock: 0, attributes: { cor: 'preto', tamanho: 'g' } },
        { code: 'CAM-AZ-M', price: 8990, stock: 2, attributes: { cor: 'azul', tamanho: 'm' } },
      ],
    });
    await createProduct('esgotado', {
      name: `Dado Esgotado ${fx.suffix}`,
      skus: [{ code: 'DAD', price: 2500, stock: 0 }],
    });
    await createProduct('barato', {
      name: `Chaveiro Barato ${fx.suffix}`,
      photo: true,
      skus: [{ code: 'CHV', price: 1500, stock: 9 }],
    });
    // Escondidos da vitrine: rascunho, sem preço e SKU inativo.
    await createProduct('rascunho', {
      name: `Rascunho ${fx.suffix}`,
      status: 'draft',
      skus: [{ code: 'RAS', price: 1000, stock: 1 }],
    });
    await createProduct('sempreco', {
      name: `Sem Preco ${fx.suffix}`,
      skus: [{ code: 'SPR', stock: 1 }],
    });
  });

  afterAll(async () => {
    const skuFilter = { sku: { product: { category_id: fx.categoryId } } };
    await prisma.skuAttributeValue.deleteMany({ where: skuFilter });
    await prisma.stockLevel.deleteMany({ where: skuFilter });
    await prisma.price.deleteMany({ where: skuFilter });
    await prisma.media.deleteMany({ where: { product: { category_id: fx.categoryId } } });
    await prisma.sku.deleteMany({
      where: { product: { category_id: fx.categoryId, NOT: { product_id: fx.productId } } },
    });
    await prisma.product.deleteMany({
      where: { category_id: fx.categoryId, NOT: { product_id: fx.productId } },
    });
    await prisma.brand.deleteMany({ where: { slug: brandSlug } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('is public: no login is needed', async () => {
    expect((await get('/api/store/products?page_size=1')).status).toBe(200);
  });

  it('lists only what can be sold: active, with an active SKU that has a price', async () => {
    const { body } = await get(`/api/store/products?category=${categorySlug}&page_size=50`);
    const slugs = body.data.map((p: { slug: string }) => p.slug).sort();
    expect(slugs).toEqual(
      [`st-barato-${fx.suffix}`, `st-camiseta-${fx.suffix}`, `st-esgotado-${fx.suffix}`].sort()
    );
    expect(body.meta.total).toBe(3);
  });

  it('shows the lowest price, the "from" promo and the stock state on the card', async () => {
    const { body } = await get(`/api/store/products?category=${categorySlug}&page_size=50`);
    const shirt = body.data.find((p: { slug: string }) => p.slug === `st-camiseta-${fx.suffix}`);
    expect(shirt).toMatchObject({
      price_cents: 8990,
      price_max_cents: 9990,
      compare_at_cents: 11990,
      sku_count: 3,
      in_stock: true,
      brand_slug: brandSlug,
      image_url: 'https://cdn.exemplo.com/camiseta.jpg',
    });
    const soldOut = body.data.find((p: { slug: string }) => p.slug === `st-esgotado-${fx.suffix}`);
    expect(soldOut).toMatchObject({ in_stock: false, image_url: null });
  });

  it('puts what is in stock and has a photo first, and sorts by price', async () => {
    const relevance = (
      await get(`/api/store/products?category=${categorySlug}&page_size=50`)
    ).body.data.map((p: { slug: string }) => p.slug);
    expect(relevance.at(-1)).toBe(`st-esgotado-${fx.suffix}`);
    const asc = (
      await get(`/api/store/products?category=${categorySlug}&sort=price_asc`)
    ).body.data.map((p: { price_cents: number }) => p.price_cents);
    expect(asc).toEqual([1500, 2500, 8990]);
    const desc = (
      await get(`/api/store/products?category=${categorySlug}&sort=price_desc`)
    ).body.data.map((p: { price_cents: number }) => p.price_cents);
    expect(desc).toEqual([8990, 2500, 1500]);
  });

  it('filters by search (punctuation-insensitive), brand, price range and availability', async () => {
    const base = `/api/store/products?category=${categorySlug}`;
    const names = async (qs: string) =>
      (await get(`${base}&${qs}`)).body.data.map((p: { slug: string }) =>
        p.slug.replace(`-${fx.suffix}`, '')
      );
    expect(await names('q=rpg')).toEqual(['st-camiseta']);
    expect(await names(`brand=${brandSlug}`)).toEqual(['st-camiseta']);
    expect(await names('price_max=2000')).toEqual(['st-barato']);
    expect(await names('price_min=2000&price_max=3000')).toEqual(['st-esgotado']);
    expect((await names('in_stock=true')).sort()).toEqual(['st-barato', 'st-camiseta']);
    expect(await names('q=naoexiste')).toEqual([]);
  });

  it('returns nothing (not an error) for an unknown category', async () => {
    const { status, body } = await get('/api/store/products?category=nao-existe');
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('computes facets for the listed scope', async () => {
    const { body } = await get(`/api/store/products/facets?category=${categorySlug}`);
    expect(body.data.total).toBe(3);
    expect(body.data.price_min_cents).toBe(1500);
    expect(body.data.price_max_cents).toBe(9990);
    expect(body.data.brands).toEqual([
      { slug: brandSlug, name: `Marca ${fx.suffix}`, product_count: 1 },
    ]);
  });

  it('serves the product page with options, SKUs, price and stock', async () => {
    const { status, body } = await get(`/api/store/products/st-camiseta-${fx.suffix}`);
    expect(status).toBe(200);
    const data = body.data;
    expect(data.brand).toEqual({ slug: brandSlug, name: `Marca ${fx.suffix}` });
    expect(data.category_path.at(-1).slug).toBe(categorySlug);
    expect(data.images).toHaveLength(1);
    expect(data.options.map((o: { code: string }) => o.code)).toEqual(['cor', 'tamanho']);
    expect(data.options[0].values.map((v: { code: string }) => v.code).sort()).toEqual([
      'azul',
      'preto',
    ]);
    expect(data.options[1].values.map((v: { code: string }) => v.code).sort()).toEqual(['g', 'm']);
    const bySku = Object.fromEntries(
      data.skus.map((s: { code: string }) => [s.code.slice(0, 8), s])
    );
    expect(bySku['CAM-PT-M']).toMatchObject({
      price_cents: 8990,
      compare_at_cents: 11990,
      available: 3,
      attributes: { cor: 'preto', tamanho: 'm' },
    });
    expect(bySku['CAM-PT-G']).toMatchObject({ available: 0 });
  });

  it('hides drafts and products without a price on the product page too', async () => {
    expect((await get(`/api/store/products/st-rascunho-${fx.suffix}`)).status).toBe(404);
    expect((await get(`/api/store/products/st-sempreco-${fx.suffix}`)).status).toBe(404);
    expect((await get('/api/store/products/nao-existe-mesmo')).status).toBe(404);
  });

  it('lists categories with the sellable count and builds the home', async () => {
    const categories = (await get('/api/store/categories')).body.data;
    expect(categories.find((c: { slug: string }) => c.slug === categorySlug)?.product_count).toBe(
      3
    );

    const home = (await get('/api/store/home')).body.data;
    expect(Array.isArray(home.new_arrivals)).toBe(true);
    for (const card of home.new_arrivals) {
      expect(card.image_url).not.toBeNull();
      expect(card.in_stock).toBe(true);
    }
  });

  it('loads favorites by id, ignoring invalid ids', async () => {
    const { body } = await get(`/api/store/products?ids=${ids.camiseta},nao-e-uuid,${ids.barato}`);
    expect(body.data.map((p: { slug: string }) => p.slug).sort()).toEqual([
      `st-barato-${fx.suffix}`,
      `st-camiseta-${fx.suffix}`,
    ]);
    expect((await get('/api/store/products?ids=lixo')).body.data).toEqual([]);
  });
});
