import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { moveProducts } from './product.service';

describe('moving products between categories (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let targetId: string;
  let otherTargetId: string;
  const ids: string[] = [];

  async function createProduct(name: string) {
    const index = ids.length;
    const product = await prisma.product.create({
      data: {
        code: `MV-${fx.suffix.toUpperCase()}-${index}`,
        name,
        slug: `mv-${fx.suffix}-${index}`,
        category_id: fx.categoryId,
        status: 'active',
      },
    });
    ids.push(product.product_id);
    return product.product_id;
  }

  beforeAll(async () => {
    fx = await createCatalogFixture();
    targetId = (
      await prisma.category.create({
        data: { name: `Destino ${fx.suffix}`, slug: `destino-${fx.suffix}` },
      })
    ).category_id;
    otherTargetId = (
      await prisma.category.create({
        data: { name: `Outro ${fx.suffix}`, slug: `outro-${fx.suffix}` },
      })
    ).category_id;
    await createProduct(`Caneca Move ${fx.suffix} A`);
    await createProduct(`Caneca Move ${fx.suffix} B`);
    await createProduct(`Camiseta Move ${fx.suffix} C`);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { product_id: { in: ids } } });
    await prisma.category.deleteMany({ where: { category_id: { in: [targetId, otherTargetId] } } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  const categoryOf = async (productId: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { product_id: productId } })).category_id;

  it('moves the chosen products and audits each one with before and after', async () => {
    const [first, second] = ids;
    const result = await moveProducts(fx.userId, {
      category_id: targetId,
      product_ids: [first as string, second as string],
    });
    expect(result).toEqual({ moved: 2 });
    expect(await categoryOf(first as string)).toBe(targetId);
    expect(await categoryOf(second as string)).toBe(targetId);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: 'product', entity_id: first as string, user_id: fx.userId },
      orderBy: { created_at: 'desc' },
    });
    expect(audit.before).toEqual({ category_id: fx.categoryId });
    expect(audit.after).toEqual({ category_id: targetId });
  });

  it('does nothing (and audits nothing) for products already in the target', async () => {
    const [first] = ids;
    const before = await prisma.auditLog.count({ where: { entity_id: first as string } });
    expect(
      await moveProducts(fx.userId, { category_id: targetId, product_ids: [first as string] })
    ).toEqual({ moved: 0 });
    expect(await prisma.auditLog.count({ where: { entity_id: first as string } })).toBe(before);
  });

  it('moves everything a list filter shows (category + search), and only that', async () => {
    // Na categoria da fixture sobrou só a "Camiseta ... C"; a busca "move" pega os dela.
    const result = await moveProducts(fx.userId, {
      category_id: otherTargetId,
      filter: { category_id: targetId, q: 'caneca' },
    });
    expect(result).toEqual({ moved: 2 });
    const [first, second, third] = ids;
    expect(await categoryOf(first as string)).toBe(otherTargetId);
    expect(await categoryOf(second as string)).toBe(otherTargetId);
    expect(await categoryOf(third as string)).toBe(fx.categoryId); // fora do filtro: intacto
  });

  it('refuses an unknown target category and changes nothing', async () => {
    const [, , third] = ids;
    await expect(
      moveProducts(fx.userId, {
        category_id: '019a0000-0000-7000-8000-000000000000',
        product_ids: [third as string],
      })
    ).rejects.toThrow(/Categoria de destino/);
    expect(await categoryOf(third as string)).toBe(fx.categoryId);
  });
});
