import { createHmac, timingSafeEqual } from 'node:crypto';

import { BadRequestError } from '../../core/_errors';
import { envConfig } from '../../core/config/env';
import {
  type ChargeInput,
  type ChargeResult,
  type PaymentProvider,
  ttlMinutesOf,
} from './payment-provider';

const API_URL = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15_000;
const CENTS_PER_REAL = 100;
const MS_PER_MINUTE = 60_000;
const BRAZIL_OFFSET_MINUTES = -180;

const PAYMENT_METHOD_IDS = { pix: 'pix', boleto: 'bolbradesco' } as const;

export type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string;
  payment_method_id?: string;
  installments?: number;
  card?: { last_four_digits?: string };
  date_of_expiration?: string | null;
  barcode?: { content?: string };
  transaction_details?: { external_resource_url?: string };
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
};

export class MercadoPagoError extends Error {}

/** Estado do pagamento no Mercado Pago -> estado da loja. Em análise/autorizado ainda é pendente. */
export function mapStatus(status: string): 'pending' | 'approved' | 'declined' {
  if (status === 'approved') return 'approved';
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) return 'declined';
  return 'pending';
}

/** O Mercado Pago pede a data com o fuso (`...-03:00`), não em UTC. */
export function toMercadoPagoDate(date: Date): string {
  const local = new Date(date.getTime() + BRAZIL_OFFSET_MINUTES * MS_PER_MINUTE);
  return `${local.toISOString().slice(0, -1)}-03:00`;
}

function identificationOf(document: string) {
  return { type: document.length > 11 ? 'CNPJ' : 'CPF', number: document };
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const [first = fullName, ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(' ') || first };
}

/** Corpo da cobrança. Cartão vai só com o token do SDK; Pix e boleto levam o prazo de validade. */
export function buildPaymentBody(input: ChargeInput, expiresAt: Date | null) {
  const { payer } = input;
  const notificationBase = envConfig.payments.API_PUBLIC_URL;
  const body: Record<string, unknown> = {
    transaction_amount: input.amountCents / CENTS_PER_REAL,
    description: `Pedido #${input.orderNumber} GeekStore`,
    external_reference: String(input.orderNumber),
    installments: input.method === 'card' ? input.installments : 1,
    payer: {
      email: payer.email,
      ...splitName(payer.name),
      ...(payer.document ? { identification: identificationOf(payer.document) } : {}),
    },
    ...(notificationBase
      ? { notification_url: `${notificationBase.replace(/\/$/, '')}/api/webhooks/mercadopago` }
      : {}),
  };

  if (input.method === 'card') {
    body.token = input.cardToken;
    if (input.cardPaymentMethodId) body.payment_method_id = input.cardPaymentMethodId;
    if (input.cardIssuerId) body.issuer_id = Number(input.cardIssuerId);
    return body;
  }

  body.payment_method_id = PAYMENT_METHOD_IDS[input.method];
  if (expiresAt) body.date_of_expiration = toMercadoPagoDate(expiresAt);
  if (input.method === 'boleto') {
    if (!payer.document || !payer.address) {
      throw new BadRequestError('Para pagar com boleto, informe o CPF/CNPJ e o endereço.');
    }
    (body.payer as Record<string, unknown>).address = {
      zip_code: payer.address.zip,
      street_name: payer.address.street,
      street_number: payer.address.number,
      neighborhood: payer.address.neighborhood,
      city: payer.address.city,
      federal_unit: payer.address.state,
    };
  }
  return body;
}

/** O que a tela mostra, no mesmo formato do provedor simulado (`pix_code`, `barcode_line`...). */
export function buildDetails(payment: MercadoPagoPayment, input: ChargeInput) {
  if (input.method === 'pix') {
    const data = payment.point_of_interaction?.transaction_data;
    return {
      pix_code: data?.qr_code ?? '',
      pix_qr_base64: data?.qr_code_base64 ?? null,
      ticket_url: data?.ticket_url ?? null,
    };
  }
  if (input.method === 'boleto') {
    return {
      barcode_line: payment.barcode?.content ?? '',
      boleto_url: payment.transaction_details?.external_resource_url ?? null,
      due_date: (payment.date_of_expiration ?? '').slice(0, 10),
    };
  }
  return {
    brand: payment.payment_method_id ?? 'cartão',
    last4: payment.card?.last_four_digits ?? '',
    installments: payment.installments ?? input.installments,
    status_detail: payment.status_detail ?? null,
  };
}

async function request<T>(
  accessToken: string,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string }
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new MercadoPagoError(
      `Mercado Pago respondeu ${response.status}: ${detail.slice(0, 300)}`
    );
  }
  return (await response.json()) as T;
}

/** Consulta o pagamento no Mercado Pago: a fonte da verdade do estado, nunca o corpo do aviso. */
export function fetchPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const { MERCADOPAGO_ACCESS_TOKEN } = envConfig.payments;
  if (!MERCADOPAGO_ACCESS_TOKEN) throw new MercadoPagoError('Mercado Pago não configurado.');
  return request<MercadoPagoPayment>(
    MERCADOPAGO_ACCESS_TOKEN,
    `/v1/payments/${encodeURIComponent(paymentId)}`,
    { method: 'GET' }
  );
}

export function mercadoPagoProvider(): PaymentProvider {
  const { MERCADOPAGO_ACCESS_TOKEN } = envConfig.payments;
  if (!MERCADOPAGO_ACCESS_TOKEN) throw new MercadoPagoError('Mercado Pago não configurado.');
  return {
    name: 'mercadopago',
    async createCharge(input): Promise<ChargeResult> {
      if (input.method === 'card' && !input.cardToken) {
        throw new BadRequestError('Dados do cartão inválidos. Confira e tente de novo.');
      }
      const expiresAt =
        input.method === 'card'
          ? null
          : new Date(Date.now() + ttlMinutesOf(input.method) * MS_PER_MINUTE);
      let payment: MercadoPagoPayment;
      try {
        payment = await request<MercadoPagoPayment>(MERCADOPAGO_ACCESS_TOKEN, '/v1/payments', {
          method: 'POST',
          body: buildPaymentBody(input, expiresAt),
          idempotencyKey: `${input.idempotencyKey}:${input.method}`,
        });
      } catch (error) {
        if (error instanceof BadRequestError) throw error;
        console.error('[mercadopago] cobrança falhou:', error);
        throw new BadRequestError(
          'Não consegui processar o pagamento agora. Confira os dados ou escolha outra forma de pagamento.'
        );
      }
      return {
        externalId: String(payment.id),
        status: mapStatus(payment.status),
        details: buildDetails(payment, input),
        expiresAt,
      };
    },
  };
}

/**
 * Confere a assinatura `x-signature` do aviso (`ts=...,v1=...`): HMAC-SHA256 com o segredo do webhook
 * sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Sem segredo configurado, recusa tudo.
 */
export function verifySignature(input: {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string;
  secret: string | undefined;
}): boolean {
  if (!input.secret || !input.signatureHeader) return false;
  const parts = Object.fromEntries(
    input.signatureHeader.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key, value.join('=')];
    })
  ) as Record<string, string | undefined>;
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;
  // Ids alfanuméricos entram em minúsculas no modelo da assinatura.
  const id = /^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
  const manifest = `id:${id};request-id:${input.requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');
  const received = Buffer.from(v1, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}
