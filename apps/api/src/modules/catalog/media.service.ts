import { prisma } from '@geekstore/db';
import type { Media, MediaBody, MediaUpdateBody } from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { toMedia } from './catalog.mappers';

async function assertSkuBelongsToProduct(
  productId: string,
  skuId: string | null | undefined
): Promise<void> {
  if (!skuId) return;
  const sku = await prisma.sku.findUnique({ where: { sku_id: skuId } });
  if (!sku || sku.product_id !== productId) {
    throw new BadRequestError('O SKU informado não pertence a este produto.');
  }
}

export async function createMedia(productId: string, body: MediaBody): Promise<Media> {
  const product = await prisma.product.findUnique({ where: { product_id: productId } });
  if (!product) throw new NotFoundError('Produto não encontrado.');
  await assertSkuBelongsToProduct(productId, body.sku_id);

  const created = await prisma.media.create({ data: { ...body, product_id: productId } });
  return toMedia(created);
}

export async function updateMedia(mediaId: string, body: MediaUpdateBody): Promise<Media> {
  const existing = await prisma.media.findUnique({ where: { media_id: mediaId } });
  if (!existing) throw new NotFoundError('Imagem não encontrada.');
  await assertSkuBelongsToProduct(existing.product_id, body.sku_id);

  const updated = await prisma.media.update({ where: { media_id: mediaId }, data: body });
  return toMedia(updated);
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const { count } = await prisma.media.deleteMany({ where: { media_id: mediaId } });
  if (count === 0) throw new NotFoundError('Imagem não encontrada.');
}
