import { type Prisma, prisma } from '@geekstore/db';
import type { Sku, SkuBody } from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { toSku } from './catalog.mappers';
import { assertSkuCodesAvailable } from './product.service';
import type { SkuUpdateRequest } from './schemas/sku-update';
import { replaceSkuAttributes, resolveAttributes, skuAttributeInclude } from './sku-attributes';

export async function createSku(actorId: string, productId: string, body: SkuBody): Promise<Sku> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { product_id: productId } });
    if (!product) throw new NotFoundError('Produto não encontrado.');
    await assertSkuCodesAvailable(tx, [body.code]);
    const { attributes, ...fields } = body;
    const resolved = await resolveAttributes(tx, product.category_id, attributes);

    const created = await tx.sku.create({ data: { ...fields, product_id: productId } });
    await replaceSkuAttributes(tx, created.sku_id, resolved);
    const withAttributes = await tx.sku.findUniqueOrThrow({
      where: { sku_id: created.sku_id },
      include: skuAttributeInclude,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'sku',
      entityId: created.sku_id,
      action: 'create',
      after: { ...created, attributes },
    });
    return toSku(withAttributes);
  });
}

export async function updateSku(
  actorId: string,
  skuId: string,
  request: SkuUpdateRequest
): Promise<Sku> {
  const { code, attributes, ...changes } = request;

  return prisma.$transaction(async (tx) => {
    const before = await tx.sku.findUnique({
      where: { sku_id: skuId },
      include: { ...skuAttributeInclude, product: { select: { category_id: true } } },
    });
    if (!before) throw new NotFoundError('SKU não encontrado.');
    const resolved = attributes
      ? await resolveAttributes(tx, before.product.category_id, attributes)
      : null;
    if (code !== undefined && code !== before.code) {
      throw new BadRequestError('O código do SKU é imutável e não pode ser alterado.');
    }

    await tx.sku.update({
      where: { sku_id: skuId },
      data: changes as Prisma.SkuUncheckedUpdateInput,
    });
    if (resolved) await replaceSkuAttributes(tx, skuId, resolved);
    const updated = await tx.sku.findUniqueOrThrow({
      where: { sku_id: skuId },
      include: skuAttributeInclude,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'sku',
      entityId: skuId,
      action: 'update',
      before: {
        ...before,
        product: undefined,
        attribute_values: undefined,
        attributes: toSku(before).attributes,
      },
      after: { ...updated, attribute_values: undefined, attributes: toSku(updated).attributes },
    });
    return toSku(updated);
  });
}
