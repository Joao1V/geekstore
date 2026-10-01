import { type Prisma, prisma } from '@geekstore/db';
import type { Sku, SkuBody } from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { toSku } from './catalog.mappers';
import { assertSkuCodesAvailable } from './product.service';
import type { SkuUpdateRequest } from './schemas/sku-update';

export async function createSku(actorId: string, productId: string, body: SkuBody): Promise<Sku> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { product_id: productId } });
    if (!product) throw new NotFoundError('Produto não encontrado.');
    await assertSkuCodesAvailable(tx, [body.code]);

    const created = await tx.sku.create({ data: { ...body, product_id: productId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'sku',
      entityId: created.sku_id,
      action: 'create',
      after: created,
    });
    return toSku(created);
  });
}

export async function updateSku(
  actorId: string,
  skuId: string,
  request: SkuUpdateRequest
): Promise<Sku> {
  const { code, ...changes } = request;

  return prisma.$transaction(async (tx) => {
    const before = await tx.sku.findUnique({ where: { sku_id: skuId } });
    if (!before) throw new NotFoundError('SKU não encontrado.');
    if (code !== undefined && code !== before.code) {
      throw new BadRequestError('O código do SKU é imutável e não pode ser alterado.');
    }

    const updated = await tx.sku.update({
      where: { sku_id: skuId },
      data: changes as Prisma.SkuUncheckedUpdateInput,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'sku',
      entityId: skuId,
      action: 'update',
      before,
      after: updated,
    });
    return toSku(updated);
  });
}
