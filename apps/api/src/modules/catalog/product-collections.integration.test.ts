import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { setProductCollections } from './collection.service';

describe('setProductCollections (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  let collectionIds: string[];
  let otherProductId: string;

  const linksOf = async (collectionId: string) =>
    prisma.collectionProduct.findMany({
      where: { collection_id: collectionId },
      orderBy: { position: 'asc' },
    });

  beforeAll(async () => {
    fx = await createCatalogFixture();
    const collections = await Promise.all(
      ['a', 'b', 'c'].map((letter) =>
        prisma.collection.create({
          data: {
            name: `Col ${letter} ${fx.suffix}`,
            slug: `col-${letter}-${fx.suffix}`,
            kind: 'franchise',
          },
        })
      )
    );
    collectionIds = collections.map((collection) => collection.collection_id);
    const other = await prisma.product.create({
      data: {
        category_id: fx.categoryId,
        code: `OTH-${fx.suffix}`,
        name: `Outro ${fx.suffix}`,
        slug: `outro-${fx.suffix}`,
      },
    });
    otherProductId = other.product_id;
    // Outro produto já ocupa a posição 0 da coleção "a": o produto do teste deve entrar depois dele.
    await prisma.collectionProduct.create({
      data: { collection_id: collectionIds[0] as string, product_id: otherProductId, position: 0 },
    });
  });

  afterAll(async () => {
    await prisma.collection.deleteMany({ where: { collection_id: { in: collectionIds } } });
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('adds the product at the end of each collection without touching the other links', async () => {
    await setProductCollections(fx.userId, fx.productId, [
      collectionIds[0] as string,
      collectionIds[1] as string,
    ]);

    const a = await linksOf(collectionIds[0] as string);
    expect(a.map((link) => [link.product_id, link.position])).toEqual([
      [otherProductId, 0],
      [fx.productId, 1],
    ]);
    expect((await linksOf(collectionIds[1] as string)).map((link) => link.product_id)).toEqual([
      fx.productId,
    ]);
  });

  it('removes only the unchecked collections and keeps the order of the ones that stay', async () => {
    await setProductCollections(fx.userId, fx.productId, [
      collectionIds[1] as string,
      collectionIds[2] as string,
    ]);

    expect((await linksOf(collectionIds[0] as string)).map((link) => link.product_id)).toEqual([
      otherProductId,
    ]);
    expect((await linksOf(collectionIds[1] as string)).map((link) => link.product_id)).toEqual([
      fx.productId,
    ]);
    expect((await linksOf(collectionIds[2] as string)).map((link) => link.product_id)).toEqual([
      fx.productId,
    ]);
  });

  it('an empty list unlinks the product from every collection', async () => {
    await setProductCollections(fx.userId, fx.productId, []);
    const left = await prisma.collectionProduct.count({ where: { product_id: fx.productId } });
    expect(left).toBe(0);
  });

  it('rejects duplicates, unknown collections and unknown products', async () => {
    const id = collectionIds[0] as string;
    await expect(setProductCollections(fx.userId, fx.productId, [id, id])).rejects.toBeInstanceOf(
      BadRequestError
    );
    await expect(
      setProductCollections(fx.userId, fx.productId, ['00000000-0000-7000-8000-000000000000'])
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      setProductCollections(fx.userId, '00000000-0000-7000-8000-000000000000', [])
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
