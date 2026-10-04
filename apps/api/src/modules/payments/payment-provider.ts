import { randomUUID } from 'node:crypto';
import type { PaymentMethod } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';

// Todo pagamento passa por esta interface (RF-PAG-01): trocar o gateway (Vindi) não mexe no checkout.
export type ChargeInput = {
  orderNumber: number;
  amountCents: number;
  method: PaymentMethod;
  installments: number;
  /** Cartão: o token do provedor, nunca o número do cartão. */
  cardToken?: string;
};

export type ChargeResult = {
  externalId: string;
  status: 'pending' | 'approved' | 'declined';
  /** O que a tela precisa mostrar (código Pix, linha do boleto, final do cartão). */
  details: Record<string, unknown>;
  expiresAt: Date | null;
};

export type PaymentProvider = {
  readonly name: string;
  createCharge(input: ChargeInput): Promise<ChargeResult>;
};

const MS_PER_MINUTE = 60_000;
export const PIX_TTL_MINUTES = 30;
export const CARD_TTL_MINUTES = 15;
export const BOLETO_TTL_MINUTES = 48 * 60;

/** Quanto tempo a reserva de estoque (e a cobrança) valem, por meio de pagamento (RF-EST-03). */
export const ttlMinutesOf = (method: PaymentMethod): number =>
  ({ pix: PIX_TTL_MINUTES, card: CARD_TTL_MINUTES, boleto: BOLETO_TTL_MINUTES })[method];

const TOKEN_PATTERN = /^mock_tok_(approved|declined)_(\d{4})$/;

/**
 * Provedor simulado, para desenvolver e testar sem gateway. Cartão: o token diz o resultado
 * (`mock_tok_approved_4242` aprova, `mock_tok_declined_0002` recusa) e responde na hora. Pix e boleto
 * ficam pendentes até o "pagamento" chegar pelo webhook.
 */
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async createCharge(input) {
    const externalId = `mock_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + ttlMinutesOf(input.method) * MS_PER_MINUTE);

    if (input.method === 'pix') {
      const code = `00020126MOCKPIX${input.orderNumber}${externalId.slice(5, 17)}6304`;
      return { externalId, status: 'pending', details: { pix_code: code }, expiresAt };
    }
    if (input.method === 'boleto') {
      const digits = Array.from({ length: 47 }, () => Math.floor(Math.random() * 10)).join('');
      return {
        externalId,
        status: 'pending',
        details: { barcode_line: digits, due_date: expiresAt.toISOString().slice(0, 10) },
        expiresAt,
      };
    }
    const token = TOKEN_PATTERN.exec(input.cardToken ?? '');
    if (!token) throw new BadRequestError('Dados do cartão inválidos. Confira e tente de novo.');
    const approved = token[1] === 'approved';
    return {
      externalId,
      status: approved ? 'approved' : 'declined',
      details: { brand: 'Cartão de teste', last4: token[2], installments: input.installments },
      expiresAt: null,
    };
  },
};

export const paymentProvider: PaymentProvider = mockProvider;
