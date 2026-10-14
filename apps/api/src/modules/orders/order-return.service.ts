import { prisma } from '@geekstore/db';
import type { Order, OrderReturnBody, OrderReturnReceiveBody } from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { recordMovement } from '../stock/movement-writer';
import { addOnHand } from '../stock/stock-ledger';
import { orderInclude, toOrder } from './order-mapper';

const QUARANTINE_NAME = 'Quarentena';
const SHIPPED_STATES = ['shipped', 'partially_shipped', 'delivered'];

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadOrder(number: number) {
  const order = await prisma.order.findUnique({ where: { number }, include: orderInclude });
  if (!order) throw new NotFoundError('Pedido não encontrado.');
  return order;
}

/** O local da quarentena (devolução sem condição de venda): criado na primeira vez que alguém precisa. */
async function quarantineLocation(tx: Tx): Promise<string> {
  const existing = await tx.location.findFirst({
    where: { type: 'quarantine' },
    orderBy: { created_at: 'asc' },
  });
  if (existing) return existing.location_id;
  const created = await tx.location.create({ data: { name: QUARANTINE_NAME, type: 'quarantine' } });
  return created.location_id;
}

/**
 * Pede a devolução de itens já enviados (RF-PED-04). Ainda não mexe no estoque nem no dinheiro: a
 * mercadoria precisa chegar e ser avaliada (`receiveReturn`); o estorno é uma operação à parte.
 */
export async function requestReturn(
  actorId: string,
  number: number,
  body: OrderReturnBody
): Promise<Order> {
  const order = await loadOrder(number);
  if (order.status === 'cancelled' || !SHIPPED_STATES.includes(order.fulfillment_status)) {
    throw new ConflictError('Só dá para devolver itens de um pedido que já foi enviado.');
  }
  const skuIds = body.items.map((item) => item.sku_id);
  if (new Set(skuIds).size !== skuIds.length) {
    throw new BadRequestError('Cada item aparece uma vez só na devolução.');
  }

  await prisma.$transaction(async (tx) => {
    // Trava o pedido: dois pedidos de devolução ao mesmo tempo não passam da quantidade comprada.
    await tx.$queryRaw`SELECT 1 FROM "order" WHERE order_id = ${order.order_id}::uuid FOR UPDATE`;
    const already = await tx.orderReturnItem.groupBy({
      by: ['sku_id'],
      where: { order_return: { order_id: order.order_id } },
      _sum: { quantity: true },
    });
    const returned = new Map(already.map((row) => [row.sku_id, row._sum.quantity ?? 0]));
    for (const item of body.items) {
      const bought = order.items.find((line) => line.sku_id === item.sku_id);
      if (!bought) throw new BadRequestError('Este item não faz parte do pedido.');
      const left = bought.quantity - (returned.get(item.sku_id) ?? 0);
      if (item.quantity > left) {
        throw new ConflictError(
          `Só dá para devolver mais ${left} un. de "${bought.name}" (o resto já foi devolvido ou está em devolução).`
        );
      }
    }
    const created = await tx.orderReturn.create({
      data: {
        order_id: order.order_id,
        reason: body.reason,
        user_id: actorId,
        items: {
          create: body.items.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })),
        },
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'order_return',
      entityId: created.order_return_id,
      action: 'create',
      before: null,
      after: { order: number, reason: body.reason, items: body.items },
    });
  });
  return toOrder(await loadOrder(number));
}

/**
 * Recebe a devolução e a avalia: o que está em condição de venda volta ao depósito (movimento
 * `return`); o resto vai para a quarentena, fora do disponível vendável. Só depois disso o estoque muda.
 */
export async function receiveReturn(
  actorId: string,
  number: number,
  returnId: string,
  body: OrderReturnReceiveBody
): Promise<Order> {
  const order = await loadOrder(number);
  const target = order.returns.find((item) => item.order_return_id === returnId);
  if (!target) throw new NotFoundError('Devolução não encontrada.');
  if (target.status === 'received') throw new ConflictError('Esta devolução já foi recebida.');

  const byId = new Map(body.items.map((item) => [item.sku_id, item]));
  if (byId.size !== body.items.length || byId.size !== target.items.length) {
    throw new BadRequestError('Avalie todos os itens da devolução, uma vez cada.');
  }
  for (const line of target.items) {
    const evaluated = byId.get(line.sku_id);
    if (!evaluated) throw new BadRequestError('Avalie todos os itens da devolução.');
    if (evaluated.resellable_quantity + evaluated.damaged_quantity !== line.quantity) {
      throw new BadRequestError(
        `Em "${line.sku.code}", vendável mais danificado deve somar ${line.quantity}.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // O UPDATE condicional é a trava: receber duas vezes ao mesmo tempo, só uma passa.
    const claimed = await tx.orderReturn.updateMany({
      where: { order_return_id: returnId, status: 'requested' },
      data: { status: 'received', received_at: new Date() },
    });
    if (claimed.count === 0) throw new ConflictError('Esta devolução já foi recebida.');

    const warehouse = await tx.location.findFirstOrThrow({
      where: { type: 'warehouse' },
      orderBy: { created_at: 'asc' },
    });
    for (const line of target.items) {
      const evaluated = byId.get(line.sku_id);
      if (!evaluated) continue;
      await tx.orderReturnItem.updateMany({
        where: { order_return_id: returnId, sku_id: line.sku_id },
        data: {
          resellable_quantity: evaluated.resellable_quantity,
          damaged_quantity: evaluated.damaged_quantity,
        },
      });
      const destinations: Array<{ locationId: string | null; quantity: number; reason: string }> = [
        {
          locationId: warehouse.location_id,
          quantity: evaluated.resellable_quantity,
          reason: `Devolução do pedido #${number}: em condição de venda`,
        },
        {
          locationId: evaluated.damaged_quantity > 0 ? await quarantineLocation(tx) : null,
          quantity: evaluated.damaged_quantity,
          reason: `Devolução do pedido #${number}: sem condição de venda (quarentena)`,
        },
      ];
      for (const destination of destinations) {
        if (!destination.locationId || destination.quantity <= 0) continue;
        const after = await addOnHand(
          tx,
          { skuId: line.sku_id, locationId: destination.locationId },
          destination.quantity
        );
        await recordMovement(
          tx,
          {
            sku_id: line.sku_id,
            location_id: destination.locationId,
            type: 'return',
            quantity: destination.quantity,
            reason: destination.reason,
            reference_type: 'order_return',
            reference_id: returnId,
            user_id: actorId,
          },
          after
        );
      }
    }
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'order_return',
      entityId: returnId,
      action: 'update',
      before: { status: 'requested' },
      after: { status: 'received', items: body.items },
    });
  });
  return toOrder(await loadOrder(number));
}
