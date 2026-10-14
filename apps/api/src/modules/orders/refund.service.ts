import { prisma } from '@geekstore/db';
import type { Order, RefundBody } from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { writeOutboxEvent } from '../../core/outbox/outbox';
import { providerFor } from '../payments/get-payment-provider';
import { orderInclude, toOrder } from './order-mapper';

const brl = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Estorna dinheiro de um pedido pago, total ou parcial (RF-PAG-06). Só mexe no financeiro: cancelar o
 * pedido e repor estoque são operações à parte. O estorno nasce `pending` dentro de uma transação que
 * trava o pagamento (a soma dos estornos nunca passa do valor pago, mesmo com dois cliques); o
 * provedor é chamado fora da transação, com o id do estorno como chave de idempotência.
 */
export async function refundOrder(
  actorId: string,
  number: number,
  body: RefundBody
): Promise<Order> {
  const order = await prisma.order.findUnique({
    where: { number },
    include: { payments: { where: { status: 'approved' }, take: 1 } },
  });
  if (!order) throw new NotFoundError('Pedido não encontrado.');
  const payment = order.payments[0];
  if (!payment) throw new ConflictError('Este pedido não tem pagamento aprovado para estornar.');

  const refund = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM payment WHERE payment_id = ${payment.payment_id}::uuid FOR UPDATE`;
    const used = await tx.refund.aggregate({
      where: { payment_id: payment.payment_id, status: { in: ['pending', 'succeeded'] } },
      _sum: { amount_cents: true },
    });
    const remaining = payment.amount_cents - (used._sum.amount_cents ?? 0);
    const amount = body.amount_cents ?? remaining;
    if (remaining <= 0) throw new ConflictError('Este pedido já foi estornado por inteiro.');
    if (amount <= 0 || amount > remaining) {
      throw new ConflictError(`Só dá para estornar até ${brl(remaining)} neste pedido.`);
    }
    const created = await tx.refund.create({
      data: {
        payment_id: payment.payment_id,
        order_id: order.order_id,
        amount_cents: amount,
        reason: body.reason,
        user_id: actorId,
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'refund',
      entityId: created.refund_id,
      action: 'create',
      before: null,
      after: { order: number, amount_cents: amount, reason: body.reason },
    });
    return created;
  });

  try {
    const result = await providerFor(payment.provider).refund({
      externalId: payment.external_id,
      idempotencyKey: refund.refund_id,
      amountCents: refund.amount_cents,
    });
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { refund_id: refund.refund_id },
        data: {
          status: result.status,
          external_id: result.externalId,
          processed_at: result.status === 'succeeded' ? new Date() : null,
        },
      });
      if (result.status !== 'succeeded') return;
      const done = await tx.refund.aggregate({
        where: { payment_id: payment.payment_id, status: 'succeeded' },
        _sum: { amount_cents: true },
      });
      const total = done._sum.amount_cents ?? 0;
      await tx.order.update({
        where: { order_id: order.order_id },
        data: { payment_status: total >= payment.amount_cents ? 'refunded' : 'partially_refunded' },
      });
      await writeOutboxEvent(tx, {
        type: 'order.refunded',
        entityType: 'order',
        entityId: order.order_id,
        payload: { refund_id: refund.refund_id },
      });
    });
  } catch (error) {
    // Provedor recusou (ou caiu): o estorno fica `failed` e libera o valor para uma nova tentativa.
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await prisma.refund.update({
      where: { refund_id: refund.refund_id },
      data: { status: 'failed', error: message, processed_at: new Date() },
    });
    console.error('[estorno] falhou:', error);
    throw new BadRequestError(
      'O provedor de pagamento não conseguiu fazer o estorno agora. Tente de novo em instantes.'
    );
  }

  const row = await prisma.order.findUniqueOrThrow({
    where: { order_id: order.order_id },
    include: orderInclude,
  });
  return toOrder(row);
}
