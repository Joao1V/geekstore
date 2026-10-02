import type { Prisma } from '@geekstore/db';

import { writeAuditLog } from '../../core/audit';
import { addOnHand } from '../stock/stock-ledger';

const SITE_CHANNEL_CODE = 'site';
const INITIAL_STOCK_REASON = 'Estoque inicial (cadastro do produto)';

export type InitialValues = { price_cents: number | null; initial_stock: number | null };

type Context = { channelId: string; warehouseId: string };

/** Canal do site e depósito padrão: lidos uma vez por transação e reaproveitados por SKU. */
export async function loadInitialContext(tx: Prisma.TransactionClient): Promise<Context> {
  const [channel, warehouse] = await Promise.all([
    tx.channel.findUniqueOrThrow({ where: { code: SITE_CHANNEL_CODE } }),
    tx.location.findFirstOrThrow({ where: { type: 'warehouse' }, orderBy: { created_at: 'asc' } }),
  ]);
  return { channelId: channel.channel_id, warehouseId: warehouse.location_id };
}

/**
 * Grava, na mesma transação do SKU novo, o preço de venda do site e o saldo de entrada (livro-razão:
 * movimentação + saldo juntos). Sem valor informado, não grava nada: a grade de estoque completa depois.
 */
export async function applyInitialValues(
  tx: Prisma.TransactionClient,
  actorId: string,
  skuId: string,
  initial: InitialValues,
  context: Context
): Promise<void> {
  if (initial.price_cents !== null) {
    const price = await tx.price.create({
      data: {
        sku_id: skuId,
        channel_id: context.channelId,
        price_cents: initial.price_cents,
        starts_at: new Date(),
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'price',
      entityId: price.price_id,
      action: 'create',
      after: price,
    });
  }

  if (initial.initial_stock !== null && initial.initial_stock > 0) {
    const slot = { skuId, locationId: context.warehouseId };
    await addOnHand(tx, slot, initial.initial_stock);
    await tx.stockMovement.create({
      data: {
        sku_id: skuId,
        location_id: context.warehouseId,
        type: 'inbound',
        quantity: initial.initial_stock,
        reason: INITIAL_STOCK_REASON,
        user_id: actorId,
      },
    });
  }
}
