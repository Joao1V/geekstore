import { Prisma, prisma } from '@geekstore/db';

import { NotFoundError } from '../../core/_errors';
import { approvePayment, reservationExpiry, reserveItems } from '../orders/order-flow';
import { ttlMinutesOf } from './payment-provider';

export type PaymentEventState = 'approved' | 'declined' | 'expired';
export type PaymentEvent = {
  provider: string;
  eventId: string;
  externalId: string;
  state: PaymentEventState;
};
export type PaymentEventResult = { duplicate: boolean };

const PAYMENT_NOT_FOUND = 'Pagamento não encontrado';
const NO_STOCK_NOTE =
  'Pagamento aprovado depois de a reserva expirar e sem estoque: estornar ou atender.';

/**
 * Tenta reservar de novo o estoque de um pedido que expirou, mas cujo pagamento acabou chegando
 * (RF-EST-09). Numa transação própria: se faltar saldo, nada fica reservado pela metade.
 */
async function reserveAgain(
  orderId: string,
  eventId: string,
  method: Parameters<typeof ttlMinutesOf>[0]
) {
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { order_id: orderId },
        include: { items: true },
      });
      const warehouse = await tx.location.findFirstOrThrow({
        where: { type: 'warehouse' },
        orderBy: { created_at: 'asc' },
      });
      await reserveItems(
        tx,
        orderId,
        order.items.map((item) => ({
          sku_id: item.sku_id,
          quantity: item.quantity,
          name: item.name,
        })),
        warehouse.location_id,
        reservationExpiry(ttlMinutesOf(method)),
        `late-${eventId}`
      );
      await tx.order.update({
        where: { order_id: orderId },
        data: { status: 'open', cancelled_at: null, cancel_reason: null },
      });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Aplica o aviso de um provedor de pagamento. O evento é gravado ANTES de qualquer efeito e é único
 * por provedor e id (RF-PAG-04/08): o mesmo aviso chegando de novo devolve `duplicate` e não repete
 * nada. Aprovar um pagamento já aprovado também não faz nada.
 */
export async function applyPaymentEvent(event: PaymentEvent): Promise<PaymentEventResult> {
  let webhookId: string;
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        provider: event.provider,
        event_id: event.eventId,
        resource_id: event.externalId,
        state: 'received',
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
    webhookId = created.webhook_event_id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    // Já recebido: se terminou, é repetição. Se o pagamento ainda não existia (o aviso chegou antes de
    // ele ser gravado), o provedor reenviando é a chance de processar de novo (RF-PAG-08). Falha por
    // falta de estoque não se reprocessa: é uma exceção operacional.
    const previous = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_event_id: { provider: event.provider, event_id: event.eventId } },
    });
    if (previous.state !== 'failed' || previous.error !== PAYMENT_NOT_FOUND) {
      return { duplicate: true };
    }
    webhookId = previous.webhook_event_id;
  }

  const payment = await prisma.payment.findUnique({
    where: { provider_external_id: { provider: event.provider, external_id: event.externalId } },
    include: { order: true },
  });
  if (!payment) {
    await prisma.webhookEvent.update({
      where: { webhook_event_id: webhookId },
      data: { state: 'failed', error: PAYMENT_NOT_FOUND, processed_at: new Date() },
    });
    throw new NotFoundError('Pagamento não encontrado.');
  }

  let note: string | null = null;
  if (event.state === 'approved' && payment.status !== 'approved') {
    const reopened =
      payment.order.status === 'cancelled'
        ? await reserveAgain(payment.order_id, event.eventId, payment.method)
        : true;
    if (!reopened) note = NO_STOCK_NOTE;
    await prisma.$transaction(async (tx) => {
      // Só um aviso vence a corrida entre "pendente" e "aprovado".
      const claimed = await tx.payment.updateMany({
        where: { payment_id: payment.payment_id, status: { not: 'approved' } },
        data: { status: 'approved' },
      });
      if (claimed.count === 0) return;
      if (reopened) await approvePayment(tx, payment.order_id, payment.payment_id);
      else
        await tx.order.update({
          where: { order_id: payment.order_id },
          data: { payment_status: 'approved' },
        });
    });
  } else if (event.state !== 'approved' && payment.status === 'pending') {
    await prisma.payment.update({
      where: { payment_id: payment.payment_id },
      data: { status: event.state },
    });
  }

  await prisma.webhookEvent.update({
    where: { webhook_event_id: webhookId },
    data: { state: note ? 'failed' : 'processed', error: note, processed_at: new Date() },
  });
  return { duplicate: false };
}
