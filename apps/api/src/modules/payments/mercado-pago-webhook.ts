import { UnauthorizedError } from '../../core/_errors';
import { envConfig } from '../../core/config/env';
import { fetchPayment, mapStatus, verifySignature } from './mercado-pago';
import { applyPaymentEvent, type PaymentEventState } from './webhook.service';

export type MercadoPagoNotification = {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  /** `data.id` da URL, que é o que a assinatura cobre. */
  queryDataId: string | undefined;
  body: { type?: string; action?: string; data?: { id?: string | number } } | undefined;
};

const STATE_OF_STATUS: Record<ReturnType<typeof mapStatus>, PaymentEventState | null> = {
  approved: 'approved',
  declined: 'declined',
  pending: null,
};

/**
 * Aviso do Mercado Pago (RF-PAG-04/08): confere a assinatura, grava o evento e consulta o pagamento no
 * próprio Mercado Pago (o corpo do aviso nunca decide o estado). O evento é único por pagamento e
 * estado, então o mesmo aviso repetido não repete efeito. Avisos de outros tipos são ignorados.
 */
export async function handleMercadoPagoNotification(
  notification: MercadoPagoNotification
): Promise<{ handled: boolean }> {
  const dataId = notification.queryDataId ?? String(notification.body?.data?.id ?? '');
  const type = notification.body?.type;
  if (!dataId) return { handled: false };

  const valid = verifySignature({
    signatureHeader: notification.signatureHeader,
    requestId: notification.requestId,
    dataId,
    secret: envConfig.payments.MERCADOPAGO_WEBHOOK_SECRET,
  });
  if (!valid) throw new UnauthorizedError('Assinatura inválida.');
  if (type && type !== 'payment') return { handled: false };

  const payment = await fetchPayment(dataId);
  const mapped = STATE_OF_STATUS[mapStatus(payment.status)];
  const state = mapped === 'declined' && payment.status_detail === 'expired' ? 'expired' : mapped;
  // Pendente/em análise: nada a fazer ainda; o aviso da mudança de estado chega depois.
  if (!state) return { handled: true };

  await applyPaymentEvent({
    provider: 'mercadopago',
    eventId: `${payment.id}:${payment.status}`,
    externalId: String(payment.id),
    state,
  });
  return { handled: true };
}
