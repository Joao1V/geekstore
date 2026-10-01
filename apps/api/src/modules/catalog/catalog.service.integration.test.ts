import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BadRequestError, ConflictError } from '../../core/_errors';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { createCategory, deleteCategory } from './category.service';
import { createProduct } from './product.service';
import { updateSku } from './sku.service';

describe('catalog services (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;

  beforeAll(async () => {
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('SKU code is immutable: a different code is rejected, the same code is harmless', async () => {
    await expect(
      updateSku(fx.userId, fx.skuId, { code: 'OUTRO-CODIGO', weight_g: 50 })
    ).rejects.toBeInstanceOf(BadRequestError);
    const untouched = await prisma.sku.findUniqueOrThrow({ where: { sku_id: fx.skuId } });
    expect(untouched.code).toBe(fx.skuCode);
    expect(untouched.weight_g).toBeNull();

    const updated = await updateSku(fx.userId, fx.skuId, { code: fx.skuCode, weight_g: 50 });
    expect(updated).toMatchObject({ code: fx.skuCode, weight_g: 50 });
  });

  it('partial updates keep the omitted fields (no default reapplied)', async () => {
    await prisma.sku.update({ where: { sku_id: fx.skuId }, data: { ncm: '95030099' } });
    const updated = await updateSku(fx.userId, fx.skuId, { weight_g: 70 });
    expect(updated).toMatchObject({ weight_g: 70, ncm: '95030099' });
  });

  it('category tree allows 3 levels and rejects the 4th; slug is unique', async () => {
    const body = (name: string, parent_id: string | null) => ({
      name,
      slug: `${fx.suffix}-${name}`,
      parent_id,
      featured: false,
      position: 0,
      seo_title: null,
      seo_description: null,
      canonical_url: null,
    });

    const l2 = await createCategory(fx.userId, body('l2', fx.categoryId));
    const l3 = await createCategory(fx.userId, body('l3', l2.category_id));

    await expect(createCategory(fx.userId, body('l4', l3.category_id))).rejects.toBeInstanceOf(
      BadRequestError
    );
    await expect(createCategory(fx.userId, body('l2', null))).rejects.toBeInstanceOf(ConflictError);
    // categoria com filhos não pode ser excluída
    await expect(deleteCategory(fx.userId, l2.category_id)).rejects.toBeInstanceOf(ConflictError);

    await deleteCategory(fx.userId, l3.category_id);
    await deleteCategory(fx.userId, l2.category_id);
  });

  it('createProduct is all-or-nothing: a duplicate SKU code leaves no product behind', async () => {
    const slug = `${fx.suffix}-atomico`;
    await expect(
      createProduct(fx.userId, {
        category_id: fx.categoryId,
        name: 'Atômico',
        slug,
        description: null,
        brand: null,
        status: 'draft',
        seo_title: null,
        seo_description: null,
        canonical_url: null,
        skus: [
          {
            code: fx.skuCode, // já existe
            attributes: {},
            ean: null,
            weight_g: null,
            length_mm: null,
            width_mm: null,
            height_mm: null,
            ncm: null,
            cost_cents: null,
            status: 'active',
          },
        ],
      })
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await prisma.product.count({ where: { slug } })).toBe(0);
  });
});
