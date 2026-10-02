import { ensureAttributeCatalog, prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import {
  createAttribute,
  listAttributes,
  setCategoryAttributes,
  updateAttribute,
} from './attribute.service';
import { createSku } from './sku.service';

const value = (label: string, sku_suffix: string, extra = {}) => ({
  label,
  sku_suffix,
  color_hex: null,
  is_active: true,
  ...extra,
});

describe('attribute management (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  const createdAttributes: string[] = [];

  beforeAll(async () => {
    await ensureAttributeCatalog(prisma);
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await prisma.skuAttributeValue.deleteMany({
      where: { sku: { product: { category_id: fx.categoryId } } },
    });
    await prisma.categoryAttribute.deleteMany({ where: { category_id: fx.categoryId } });
    await prisma.sku.deleteMany({
      where: { product: { category_id: fx.categoryId, NOT: { product_id: fx.productId } } },
    });
    await prisma.attributeValue.deleteMany({ where: { attribute_id: { in: createdAttributes } } });
    await prisma.attribute.deleteMany({ where: { attribute_id: { in: createdAttributes } } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('creates an attribute with its values in the given order', async () => {
    const created = await createAttribute(fx.userId, {
      name: `Linha ${fx.suffix}`,
      is_active: true,
      values: [value('Beta', 'B'), value('Alfa', 'A'), value('Gama', 'G')],
    });
    createdAttributes.push(created.attribute_id);
    expect(created.values.map((v) => [v.label, v.sku_suffix, v.position])).toEqual([
      ['Beta', 'B', 0],
      ['Alfa', 'A', 1],
      ['Gama', 'G', 2],
    ]);
  });

  it('reorders, renames, deactivates and swaps SKU codes between two values', async () => {
    const [attribute] = (await listAttributes()).filter(
      (a) => a.attribute_id === createdAttributes[0]
    );
    const [beta, alfa, gama] = attribute?.values ?? [];
    const updated = await updateAttribute(fx.userId, createdAttributes[0] as string, {
      name: `Linha ${fx.suffix}`,
      is_active: true,
      values: [
        { ...gama!, color_hex: null },
        // Beta e Alfa trocam de código entre si.
        { ...alfa!, sku_suffix: 'B', label: 'Alfa 2' },
        { ...beta!, sku_suffix: 'A', is_active: false },
      ],
    });
    expect(updated.values.map((v) => [v.label, v.sku_suffix, v.is_active])).toEqual([
      ['Gama', 'G', true],
      ['Alfa 2', 'B', true],
      ['Beta', 'A', false],
    ]);
  });

  it('refuses a repeated SKU code in the list', async () => {
    await expect(
      createAttribute(fx.userId, {
        name: `Dup ${fx.suffix}`,
        is_active: true,
        values: [value('Um', 'X'), value('Dois', 'x')],
      })
    ).rejects.toThrow(/repetido/);
  });

  it('refuses to delete a value that a SKU uses, but deletes an unused one', async () => {
    const attribute = (await listAttributes()).find(
      (a) => a.attribute_id === createdAttributes[0]
    )!;
    await setCategoryAttributes(fx.userId, fx.categoryId, {
      attributes: [{ attribute_id: attribute.attribute_id, is_required: false }],
    });
    const used = attribute.values.find((v) => v.label === 'Gama')!;
    await createSku(fx.userId, fx.productId, {
      code: `ATTR-${fx.suffix}`.toUpperCase(),
      ean: null,
      ncm: null,
      weight_g: null,
      length_mm: null,
      width_mm: null,
      height_mm: null,
      cost_cents: null,
      status: 'active',
      attributes: { [attribute.code]: used.code },
    });

    const keepWithoutGama = attribute.values.filter((v) => v.label !== 'Gama');
    await expect(
      updateAttribute(fx.userId, attribute.attribute_id, {
        name: attribute.name,
        is_active: true,
        values: keepWithoutGama,
      })
    ).rejects.toThrow(/em uso por 1 SKU/);

    const keepWithoutBeta = attribute.values.filter((v) => v.label !== 'Beta');
    const after = await updateAttribute(fx.userId, attribute.attribute_id, {
      name: attribute.name,
      is_active: true,
      values: keepWithoutBeta,
    });
    expect(after.values.map((v) => v.label)).toEqual(['Gama', 'Alfa 2']);
  });
});
