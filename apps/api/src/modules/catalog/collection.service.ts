import { prisma } from '@geekstore/db';
import type { Collection, CollectionBody, CollectionUpdateBody, Product } from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { toCollection, toProduct } from './catalog.mappers';

const ENTITY = 'collection';

export async function listCollections(): Promise<Collection[]> {
  const rows = await prisma.collection.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toCollection);
}

async function assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
  const existing = await prisma.collection.findUnique({ where: { slug } });
  if (existing && existing.collection_id !== exceptId) {
    throw new ConflictError('Já existe uma coleção com esse slug.');
  }
}

export async function createCollection(actorId: string, body: CollectionBody): Promise<Collection> {
  await assertSlugAvailable(body.slug);

  return prisma.$transaction(async (tx) => {
    const created = await tx.collection.create({ data: body });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.collection_id,
      action: 'create',
      after: created,
    });
    return toCollection(created);
  });
}

export async function updateCollection(
  actorId: string,
  collectionId: string,
  body: CollectionUpdateBody
): Promise<Collection> {
  if (body.slug !== undefined) await assertSlugAvailable(body.slug, collectionId);

  return prisma.$transaction(async (tx) => {
    const before = await tx.collection.findUnique({ where: { collection_id: collectionId } });
    if (!before) throw new NotFoundError('Coleção não encontrada.');

    const updated = await tx.collection.update({
      where: { collection_id: collectionId },
      data: body,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: collectionId,
      action: 'update',
      before,
      after: updated,
    });
    return toCollection(updated);
  });
}

export async function deleteCollection(actorId: string, collectionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.collection.findUnique({ where: { collection_id: collectionId } });
    if (!before) throw new NotFoundError('Coleção não encontrada.');

    // Os vínculos com produtos caem em cascata (onDelete: Cascade); os produtos não são tocados.
    await tx.collection.delete({ where: { collection_id: collectionId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: collectionId,
      action: 'delete',
      before,
    });
  });
}

/** Produtos da coleção na ordem curada (`CollectionProduct.position`). */
export async function listCollectionProducts(collectionId: string): Promise<Product[]> {
  const collection = await prisma.collection.findUnique({ where: { collection_id: collectionId } });
  if (!collection) throw new NotFoundError('Coleção não encontrada.');

  const links = await prisma.collectionProduct.findMany({
    where: { collection_id: collectionId },
    orderBy: [{ position: 'asc' }, { collection_product_id: 'asc' }],
    include: { product: true },
  });
  return links.map((link) => toProduct(link.product));
}

/** Substitui a lista ordenada de produtos da coleção (a posição é o índice no array enviado). */
export async function replaceCollectionProducts(
  actorId: string,
  collectionId: string,
  productIds: readonly string[]
): Promise<void> {
  if (new Set(productIds).size !== productIds.length) {
    throw new BadRequestError('A lista de produtos tem itens repetidos.');
  }

  await prisma.$transaction(async (tx) => {
    const collection = await tx.collection.findUnique({ where: { collection_id: collectionId } });
    if (!collection) throw new NotFoundError('Coleção não encontrada.');

    const existingProducts = await tx.product.count({
      where: { product_id: { in: [...productIds] } },
    });
    if (existingProducts !== productIds.length) {
      throw new BadRequestError('Algum produto da lista não existe.');
    }

    const previous = await tx.collectionProduct.findMany({
      where: { collection_id: collectionId },
      orderBy: { position: 'asc' },
      select: { product_id: true },
    });

    await tx.collectionProduct.deleteMany({ where: { collection_id: collectionId } });
    await tx.collectionProduct.createMany({
      data: productIds.map((productId, position) => ({
        collection_id: collectionId,
        product_id: productId,
        position,
      })),
    });

    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: collectionId,
      action: 'update',
      before: { product_ids: previous.map((link) => link.product_id) },
      after: { product_ids: productIds },
    });
  });
}
