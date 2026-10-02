import { ensureAttributeCatalog, prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import {
  createAttributeValue,
  getCategoryAttributes,
  setCategoryAttributes,
} from './attribute.service';
import { createProduct } from './product.service';
import { createSku, updateSku } from './sku.service';

const emptySku = {
  ean: null,
  weight_g: null,
  length_mm: null,
  width_mm: null,
  height_mm: null,
  ncm: null,
  cost_cents: null,
  status: 'active' as const,
};

describe('SKU attributes (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let colorId: string;
  let sizeId: string;
  let childCategoryId: string;
  const createdValues: string[] = [];

  beforeAll(async () => {
    await ensureAttributeCatalog(prisma);
    fx = await createCatalogFixture();
    colorId = (await prisma.attribute.findUniqueOrThrow({ where: { code: 'cor' } })).attribute_id;
    sizeId = (await prisma.attribute.findUniqueOrThrow({ where: { code: 'tamanho' } }))
      .attribute_id;
    childCategoryId = (
      await prisma.category.create({
        data: {
          name: `IT Sub ${fx.suffix}`,
          slug: `it-sub-${fx.suffix}`,
          parent_id: fx.categoryId,
        },
      })
    ).category_id;
  });

  afterAll(async () => {
    await prisma.skuAttributeValue.deleteMany({
      where: { sku: { product: { category_id: { in: [fx.categoryId, childCategoryId] } } } },
    });
    await prisma.attributeValue.deleteMany({
      where: { attribute_value_id: { in: createdValues } },
    });
    await prisma.sku.deleteMany({ where: { product: { category_id: childCategoryId } } });
    await prisma.product.deleteMany({ where: { category_id: childCategoryId } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  const newSku = (code: string, attributes: Record<string, string>) => ({
    ...emptySku,
    code: `${code}-${fx.suffix}`.toUpperCase(),
    attributes,
  });

  it('rejects attributes the category does not use, and says which ones it uses', async () => {
    await expect(createSku(fx.userId, fx.productId, newSku('a', { cor: 'preto' }))).rejects.toThrow(
      /não usa o atributo: cor.*nenhum/
    );
  });

  it('accepts the attributes the category asks for and returns them as codes', async () => {
    await setCategoryAttributes(fx.userId, fx.categoryId, {
      attributes: [
        { attribute_id: colorId, is_required: true },
        { attribute_id: sizeId, is_required: false },
      ],
    });
    const sku = await createSku(
      fx.userId,
      fx.productId,
      newSku('b', { cor: 'preto', tamanho: 'gg' })
    );
    expect(sku.attributes).toEqual({ cor: 'preto', tamanho: 'gg' });
  });

  it('rejects a missing required attribute and an unknown value', async () => {
    await expect(createSku(fx.userId, fx.productId, newSku('c', { tamanho: 'p' }))).rejects.toThrow(
      /obrigatório ausente: Cor/
    );
    await expect(
      createSku(fx.userId, fx.productId, newSku('d', { cor: 'verde-xpto' }))
    ).rejects.toThrow(/não existe no atributo cor/);
  });

  it('replaces the attributes of an existing SKU on update', async () => {
    const sku = await createSku(fx.userId, fx.productId, newSku('e', { cor: 'branco' }));
    const updated = await updateSku(fx.userId, sku.sku_id, {
      attributes: { cor: 'azul', tamanho: 'm' },
    });
    expect(updated.attributes).toEqual({ cor: 'azul', tamanho: 'm' });
  });

  it('inherits the rules of the parent category in its subcategories', async () => {
    const rules = await getCategoryAttributes(childCategoryId);
    expect(rules.map((r) => [r.code, r.inherited_from])).toEqual([
      ['cor', fx.categoryId],
      ['tamanho', fx.categoryId],
    ]);
  });

  it('creates a product with variant SKUs in one go', async () => {
    const product = await createProduct(fx.userId, {
      name: `Camiseta ${fx.suffix}`,
      slug: `camiseta-${fx.suffix}`,
      category_id: childCategoryId,
      brand: null,
      description: null,
      status: 'draft',
      seo_title: null,
      seo_description: null,
      canonical_url: null,
      skus: [
        newSku('f1', { cor: 'preto', tamanho: 'p' }),
        newSku('f2', { cor: 'preto', tamanho: 'm' }),
      ],
    });
    expect(product.skus.map((s) => s.attributes.tamanho)).toEqual(['p', 'm']);
  });

  it('creates a new attribute value once, refusing a duplicate label or SKU suffix', async () => {
    const label = `Turquesa ${fx.suffix}`;
    const sku_suffix = `T${fx.suffix.slice(0, 5).toUpperCase()}`;
    const value = await createAttributeValue(fx.userId, colorId, {
      label,
      sku_suffix,
      color_hex: '#40E0D0',
    });
    createdValues.push(value.attribute_value_id);
    expect(value).toMatchObject({ label, color_hex: '#40E0D0', sku_suffix });

    await expect(
      createAttributeValue(fx.userId, colorId, { label, sku_suffix, color_hex: null })
    ).rejects.toThrow(/já existe/);
    await expect(
      createAttributeValue(fx.userId, colorId, {
        label: `Outra ${fx.suffix}`,
        sku_suffix,
        color_hex: null,
      })
    ).rejects.toThrow(/sufixo/);
  });

  it('derives the SKU suffix from the catalog when it is not given', async () => {
    const label = 'Azul Bebê';
    const value = await createAttributeValue(fx.userId, colorId, { label, color_hex: null });
    createdValues.push(value.attribute_value_id);
    expect(value.sku_suffix).toBe('AZU');
  });
});
