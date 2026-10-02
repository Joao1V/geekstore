import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { listProducts } from './product.service';
import { listSkuGrid } from './sku-grid.service';

const query = { page: 1, page_size: 20 };

describe('catalog search (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let accentedProductId: string;

  beforeAll(async () => {
    fx = await createCatalogFixture();
    const product = await prisma.product.create({
      data: {
        name: `Coleção Pokémon Ação ${fx.suffix}`,
        slug: `colecao-pokemon-acao-${fx.suffix}`,
        category_id: fx.categoryId,
        skus: { create: [{ code: `PKM-${fx.suffix.toUpperCase()}` }] },
      },
    });
    accentedProductId = product.product_id;
  });

  afterAll(async () => {
    // Preço antes do SKU (FK): se um teste falhar com o preço criado, a limpeza não pode quebrar.
    await prisma.price.deleteMany({ where: { sku: { product_id: accentedProductId } } });
    await prisma.sku.deleteMany({ where: { product_id: accentedProductId } });
    await prisma.product.delete({ where: { product_id: accentedProductId } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  const productIds = async (q: string) =>
    (await listProducts({ ...query, q })).data.map((p) => p.product_id);

  it('product search ignores case and accents, in both directions', async () => {
    expect(await productIds(`colecao pokemon acao ${fx.suffix}`)).toContain(accentedProductId);
    expect(await productIds(`COLEÇÃO POKÉMON AÇÃO ${fx.suffix}`)).toContain(accentedProductId);
  });

  it('product search also matches the slug and the SKU code', async () => {
    expect(await productIds(`pokemon-acao-${fx.suffix}`)).toContain(accentedProductId);
    expect(await productIds(`pkm-${fx.suffix}`)).toContain(accentedProductId);
  });

  it('product search treats % and _ literally, reports the total and respects the filters', async () => {
    expect(await productIds('%')).not.toContain(accentedProductId);
    const filtered = await listProducts({ ...query, q: fx.suffix, status: 'archived' });
    expect(filtered.data).toHaveLength(0);
    const all = await listProducts({ ...query, q: fx.suffix });
    expect(all.meta.total).toBe(all.data.length);
    expect(all.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('product search keeps the requested order', async () => {
    const asc = await listProducts({ ...query, q: fx.suffix, sort: 'name:asc' });
    const desc = await listProducts({ ...query, q: fx.suffix, sort: 'name:desc' });
    expect(desc.data.map((p) => p.product_id)).toEqual(asc.data.map((p) => p.product_id).reverse());
  });

  it('lists the first photo by position as the thumbnail, or null without photos', async () => {
    await prisma.media.createMany({
      data: [
        {
          product_id: accentedProductId,
          url: 'https://cdn.exemplo.com/segunda.jpg',
          alt: 'b',
          position: 1,
        },
        {
          product_id: accentedProductId,
          url: 'https://cdn.exemplo.com/primeira.jpg',
          alt: 'a',
          position: 0,
        },
      ],
    });
    const thumbnails = (rows: { product_id: string; thumbnail_url: string | null }[]) =>
      Object.fromEntries(rows.map((row) => [row.product_id, row.thumbnail_url]));
    const expected = {
      [accentedProductId]: 'https://cdn.exemplo.com/primeira.jpg',
      [fx.productId]: null,
    };

    // Sem busca (Prisma) e com busca (SQL com unaccent): os dois caminhos devolvem a miniatura.
    const byCategory = await listProducts({ ...query, category_id: fx.categoryId });
    expect(thumbnails(byCategory.data)).toEqual(expected);
    const bySearch = await listProducts({ ...query, q: fx.suffix });
    expect(thumbnails(bySearch.data)).toEqual(expected);
  });

  it('SKU grid search ignores case and accents', async () => {
    const grid = await listSkuGrid({ ...query, q: `POKEMON ACAO ${fx.suffix}` });
    expect(grid.data.map((row) => row.product_id)).toEqual([accentedProductId]);
  });

  it('SKU grid shows the SKU photo first, then the product photo, then null', async () => {
    const sku = await prisma.sku.findFirstOrThrow({ where: { product_id: accentedProductId } });
    // Posições extremas para o resultado não depender das fotos de outros testes.
    await prisma.media.create({
      data: {
        product_id: accentedProductId,
        url: 'https://cdn.exemplo.com/grid-produto.jpg',
        alt: 'p',
        position: -5,
      },
    });
    const skuPhoto = await prisma.media.create({
      data: {
        product_id: accentedProductId,
        sku_id: sku.sku_id,
        url: 'https://cdn.exemplo.com/grid-sku.jpg',
        alt: 's',
        position: 9,
      },
    });
    const thumbnails = async () => {
      const grid = await listSkuGrid({ ...query, q: fx.suffix });
      return Object.fromEntries(grid.data.map((row) => [row.product_id, row.thumbnail_url]));
    };

    expect(await thumbnails()).toMatchObject({
      [accentedProductId]: 'https://cdn.exemplo.com/grid-sku.jpg',
      [fx.productId]: null,
    });

    await prisma.media.delete({ where: { media_id: skuPhoto.media_id } });
    expect((await thumbnails())[accentedProductId]).toBe(
      'https://cdn.exemplo.com/grid-produto.jpg'
    );
  });

  it('SKU grid puts SKUs without price last, whichever the direction', async () => {
    const sku = await prisma.sku.findFirstOrThrow({ where: { product_id: accentedProductId } });
    const site = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    // Vigência no passado: o relógio do Node e o do banco (que a grade usa) podem diferir por ms.
    await prisma.price.create({
      data: {
        sku_id: sku.sku_id,
        channel_id: site.channel_id,
        price_cents: 1990,
        starts_at: new Date(Date.now() - 60_000),
      },
    });

    const ours = [fx.productId, accentedProductId];
    for (const sort of ['price_cents:asc', 'price_cents:desc']) {
      const grid = await listSkuGrid({ ...query, q: fx.suffix, sort });
      // Só os dois SKUs deste teste: o banco pode ter o catálogo real, com outros itens.
      const rows = grid.data.filter((row) => ours.includes(row.product_id));
      expect(rows).toHaveLength(2);
      expect(rows[0]?.price_cents).toBe(1990);
      expect(rows[1]?.price_cents).toBeNull();
    }
    await prisma.price.deleteMany({ where: { sku_id: sku.sku_id } });
  });
});
