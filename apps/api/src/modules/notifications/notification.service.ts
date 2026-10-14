import { Prisma, prisma } from '@geekstore/db';

import { envConfig } from '../../core/config/env';
import type { PublishedEvent } from '../../core/outbox/outbox';
import { signResetToken } from '../customers/password-reset.service';
import type { EmailSender } from './email-sender';
import {
  type DivergenceMailData,
  type OrderMailData,
  orderAwaitingPayment,
  orderCancelled,
  orderDelivered,
  orderPaid,
  orderShipped,
  passwordReset,
  type RenderedEmail,
  stockDivergence,
} from './email-templates';

type Template =
  | 'order_awaiting_payment'
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'stock_divergence'
  | 'password_reset';

const PICKUP_CARRIER = 'GeekStore';

async function loadOrderMail(orderId: string): Promise<(OrderMailData & { email: string }) | null> {
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    include: {
      items: true,
      payments: { orderBy: { created_at: 'desc' }, take: 1 },
      shipments: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  });
  if (!order) return null;
  const { STORE_URL } = envConfig.email;
  const payment = order.payments[0];
  const details = (payment?.details ?? {}) as Record<string, unknown>;
  const shipment = order.shipments[0];
  return {
    email: order.contact_email,
    number: order.number,
    contactName: order.contact_name,
    totalCents: order.total_cents,
    storeUrl: STORE_URL,
    orderUrl: `${STORE_URL}/pedido/${order.order_id}/`,
    items: order.items.map((item) => ({
      name: item.name,
      variant: item.variant,
      quantity: item.quantity,
      totalCents: item.total_cents,
    })),
    shippingService: order.shipping_service,
    payment: payment
      ? {
          method: payment.method,
          code: String(details.pix_code ?? details.barcode_line ?? '') || null,
          boletoUrl: typeof details.boleto_url === 'string' ? details.boleto_url : null,
        }
      : null,
    tracking: shipment ? { carrier: shipment.carrier, code: shipment.tracking_code } : null,
    cancelReason: order.cancel_reason,
    pickup: order.shipping_service.startsWith(PICKUP_CARRIER),
  };
}

/**
 * Manda o e-mail de um evento, no máximo uma vez com sucesso: a linha `email_message` é única por
 * evento e modelo, então reprocessar (retentativa da fila, reprocesso pelo painel) não duplica. Se o
 * envio falha, a linha fica `failed` e o erro sobe para a fila tentar de novo.
 */
async function sendOnce(
  sender: EmailSender,
  eventId: string,
  template: Template,
  to: string,
  render: () => RenderedEmail
): Promise<void> {
  const rendered = render();
  let messageId: string;
  try {
    const created = await prisma.emailMessage.create({
      data: {
        outbox_event_id: eventId,
        template,
        to_email: to,
        subject: rendered.subject.slice(0, 255),
      },
    });
    messageId = created.email_message_id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const existing = await prisma.emailMessage.findUniqueOrThrow({
      where: { outbox_event_id_template: { outbox_event_id: eventId, template } },
    });
    if (existing.status === 'sent') return;
    messageId = existing.email_message_id;
  }
  try {
    const result = await sender.send({ to, ...rendered });
    await prisma.emailMessage.update({
      where: { email_message_id: messageId },
      data: { status: 'sent', provider_id: result.id, sent_at: new Date(), error: null },
    });
  } catch (error) {
    await prisma.emailMessage.update({
      where: { email_message_id: messageId },
      data: {
        status: 'failed',
        error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      },
    });
    throw error;
  }
}

const ORDER_TEMPLATES: Record<
  string,
  { template: Template; render: (d: OrderMailData) => RenderedEmail }
> = {
  'order.paid': { template: 'order_paid', render: orderPaid },
  'order.shipped': { template: 'order_shipped', render: orderShipped },
  'order.delivered': { template: 'order_delivered', render: orderDelivered },
  'order.cancelled': { template: 'order_cancelled', render: orderCancelled },
};

/**
 * Consumidor dos eventos do outbox. Idempotente. `order.created` só avisa quando ainda falta pagar
 * (cartão aprovado na hora é coberto por `order.paid`). Evento desconhecido é ignorado.
 */
export async function handleOutboxEvent(event: PublishedEvent, sender: EmailSender): Promise<void> {
  if (event.type === 'stock.divergence_found') {
    const { ALERT_TO } = envConfig.email;
    const data = event.payload as unknown as DivergenceMailData;
    if (!ALERT_TO) {
      console.error(
        '[estoque] divergência encontrada e STORE_ALERT_EMAIL não configurado:',
        data.rows
      );
      return;
    }
    await sendOnce(sender, event.outbox_event_id, 'stock_divergence', ALERT_TO, () =>
      stockDivergence(data)
    );
    return;
  }

  if (event.type === 'customer.password_reset_requested') {
    const { password_reset_id: resetId } = event.payload as { password_reset_id: string };
    const reset = await prisma.passwordReset.findUnique({
      where: { password_reset_id: resetId },
      include: { customer: true },
    });
    // Já usado ou vencido: não há o que enviar.
    if (!reset || reset.used_at || reset.expires_at < new Date()) return;
    const { STORE_URL } = envConfig.email;
    await sendOnce(sender, event.outbox_event_id, 'password_reset', reset.customer.email, () =>
      passwordReset({
        name: reset.customer.name,
        storeUrl: STORE_URL,
        link: `${STORE_URL}/redefinir-senha/?token=${signResetToken(resetId)}`,
      })
    );
    return;
  }

  if (event.entity_type !== 'order') return;
  const data = await loadOrderMail(event.entity_id);
  if (!data) return;

  if (event.type === 'order.created') {
    const pending = data.payment && data.payment.method !== 'card';
    // Já pago na hora (cartão): `order.paid` manda o aviso.
    if (!pending || data.cancelReason) return;
    await sendOnce(sender, event.outbox_event_id, 'order_awaiting_payment', data.email, () =>
      orderAwaitingPayment(data)
    );
    return;
  }

  const entry = ORDER_TEMPLATES[event.type];
  if (!entry) return;
  await sendOnce(sender, event.outbox_event_id, entry.template, data.email, () =>
    entry.render(data)
  );
}
