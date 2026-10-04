import { type Prisma, prisma } from '@geekstore/db';

import { ConflictError } from '../../core/_errors';
import { consumeReserved, releaseReserved, reserveOnHand } from '../stock/stock-ledger';

type Tx = Prisma.TransactionClient;
const MS_PER_MINUTE = 60_000;

export type ReservableItem = { sku_id: string; quantity: number; name: string };

/**
 * Reserva o estoque dos itens, todos ou nenhum (a transação desfaz tudo se um faltar). Ordena por SKU
 * para duas compras simultâneas pegarem as linhas na mesma ordem e não travarem uma à outra.
 */
export async function reserveItems(
  tx: Tx,
  orderId: string,
  items: readonly ReservableItem[],
  locationId: string,
  expiresAt: Date,
  attempt: string
): Promise<void> {
  const ordered = [...items].sort((a, b) => a.sku_id.localeCompare(b.sku_id));
  for (const item of ordered) {
    try {
      await reserveOnHand(tx, { skuId: item.sku_id, locationId }, item.quantity);
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new ConflictError(`Sem estoque suficiente de "${item.name}". Ajuste o carrinho.`);
      }
      throw error;
    }
    await tx.stockReservation.create({
      data: {
        sku_id: item.sku_id,
        location_id: locationId,
        quantity: item.quantity,
        order_id: orderId,
        status: 'active',
        expires_at: expiresAt,
        idempotency_key: `${orderId}:${item.sku_id}:${attempt}`,
      },
    });
    await tx.stockMovement.create({
      data: {
        sku_id: item.sku_id,
        location_id: locationId,
        type: 'reservation',
        quantity: item.quantity,
        reason: 'Reserva do pedido',
        reference_type: 'order',
        reference_id: orderId,
      },
    });
  }
}

/** Pagamento aprovado: o pedido fica pago e as reservas viram "comprometidas" (esperam a expedição). */
export async function approvePayment(tx: Tx, orderId: string, paymentId: string): Promise<void> {
  await tx.payment.update({ where: { payment_id: paymentId }, data: { status: 'approved' } });
  await tx.order.update({ where: { order_id: orderId }, data: { payment_status: 'approved' } });
  await tx.stockReservation.updateMany({
    where: { order_id: orderId, status: 'active' },
    data: { status: 'committed' },
  });
}

/**
 * Cancela o pedido e devolve ao saldo o que estava reservado. Só antes da expedição: o que já saiu
 * volta por devolução (F4), não por aqui. Tentativas de pagamento pendentes expiram.
 */
export async function cancelOrder(tx: Tx, orderId: string, reason: string): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({
    where: { order_id: orderId },
    include: { shipments: true },
  });
  if (order.status === 'cancelled') return;
  if (
    order.status === 'completed' ||
    order.shipments.some((shipment) => shipment.status !== 'pending')
  ) {
    throw new ConflictError('Este pedido já foi enviado e não pode ser cancelado por aqui.');
  }
  const reservations = await tx.stockReservation.findMany({
    where: { order_id: orderId, status: { in: ['active', 'committed'] } },
  });
  for (const reservation of reservations) {
    await releaseReserved(
      tx,
      { skuId: reservation.sku_id, locationId: reservation.location_id },
      reservation.quantity
    );
    await tx.stockMovement.create({
      data: {
        sku_id: reservation.sku_id,
        location_id: reservation.location_id,
        type: 'release',
        quantity: reservation.quantity,
        reason,
        reference_type: 'order',
        reference_id: orderId,
      },
    });
  }
  await tx.stockReservation.updateMany({
    where: { order_id: orderId, status: { in: ['active', 'committed'] } },
    data: { status: 'released' },
  });
  await tx.payment.updateMany({
    where: { order_id: orderId, status: 'pending' },
    data: { status: 'expired' },
  });
  await tx.order.update({
    where: { order_id: orderId },
    data: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason.slice(0, 255) },
  });
}

/** Expedição: a unidade sai do estoque de verdade (as reservas comprometidas viram "consumidas"). */
export async function consumeOrderStock(tx: Tx, orderId: string): Promise<void> {
  const reservations = await tx.stockReservation.findMany({
    where: { order_id: orderId, status: 'committed' },
  });
  for (const reservation of reservations) {
    await consumeReserved(
      tx,
      { skuId: reservation.sku_id, locationId: reservation.location_id },
      reservation.quantity
    );
    await tx.stockMovement.create({
      data: {
        sku_id: reservation.sku_id,
        location_id: reservation.location_id,
        type: 'outbound',
        quantity: reservation.quantity,
        reason: 'Expedição do pedido',
        reference_type: 'order',
        reference_id: orderId,
      },
    });
  }
  await tx.stockReservation.updateMany({
    where: { order_id: orderId, status: 'committed' },
    data: { status: 'consumed' },
  });
}

export const reservationExpiry = (minutes: number): Date =>
  new Date(Date.now() + minutes * MS_PER_MINUTE);

/** Cancela os pedidos cujo pagamento não chegou a tempo e devolve as reservas. Devolve quantos. */
export async function expirePendingOrders(now = new Date()): Promise<number> {
  const stale = await prisma.payment.findMany({
    where: {
      status: 'pending',
      expires_at: { lt: now },
      order: { status: 'open', payment_status: 'pending' },
    },
    select: { order_id: true },
    distinct: ['order_id'],
  });
  let cancelled = 0;
  for (const { order_id } of stale) {
    try {
      await prisma.$transaction((tx) =>
        cancelOrder(tx, order_id, 'Pagamento não confirmado a tempo')
      );
      cancelled += 1;
    } catch {
      // Outro processo já tratou este pedido; segue para o próximo.
    }
  }
  return cancelled;
}
