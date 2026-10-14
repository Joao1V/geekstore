import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDetails,
  buildPaymentBody,
  mapStatus,
  mercadoPagoProvider,
  toMercadoPagoDate,
  verifySignature,
} from './mercado-pago';
import type { ChargeInput } from './payment-provider';

const PAYER = {
  name: 'Maria da Silva Souza',
  email: 'maria@exemplo.com',
  document: '12345678909',
  address: {
    zip: '30140071',
    street: 'Av. Afonso Pena',
    number: '100',
    neighborhood: 'Centro',
    city: 'Belo Horizonte',
    state: 'MG',
  },
};
const charge = (over: Partial<ChargeInput> = {}): ChargeInput => ({
  orderNumber: 1042,
  amountCents: 12_345,
  method: 'pix',
  installments: 1,
  idempotencyKey: 'key-123456',
  payer: PAYER,
  ...over,
});

beforeEach(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
  process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo';
  delete process.env.API_PUBLIC_URL;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
});

describe('mapStatus', () => {
  it('maps the Mercado Pago states', () => {
    expect(mapStatus('approved')).toBe('approved');
    expect(mapStatus('rejected')).toBe('declined');
    expect(mapStatus('cancelled')).toBe('declined');
    expect(mapStatus('in_process')).toBe('pending');
    expect(mapStatus('pending')).toBe('pending');
  });
});

describe('toMercadoPagoDate', () => {
  it('writes the date in the Brazilian offset', () => {
    expect(toMercadoPagoDate(new Date('2026-10-14T15:30:00.000Z'))).toBe(
      '2026-10-14T12:30:00.000-03:00'
    );
  });
});

describe('buildPaymentBody', () => {
  it('sends the amount in reais, the payer and the expiration for Pix', () => {
    const body = buildPaymentBody(charge(), new Date('2026-10-14T15:30:00.000Z'));
    expect(body).toMatchObject({
      transaction_amount: 123.45,
      payment_method_id: 'pix',
      external_reference: '1042',
      installments: 1,
      date_of_expiration: '2026-10-14T12:30:00.000-03:00',
      payer: {
        email: 'maria@exemplo.com',
        first_name: 'Maria',
        last_name: 'da Silva Souza',
        identification: { type: 'CPF', number: '12345678909' },
      },
    });
  });

  it('uses only the token and the installments for a card, never card numbers', () => {
    const body = buildPaymentBody(
      charge({
        method: 'card',
        installments: 3,
        cardToken: 'tok_abc',
        cardPaymentMethodId: 'visa',
        cardIssuerId: '24',
      }),
      null
    );
    expect(body).toMatchObject({
      token: 'tok_abc',
      installments: 3,
      payment_method_id: 'visa',
      issuer_id: 24,
    });
    expect(JSON.stringify(body)).not.toMatch(/card_number|cvv/i);
  });

  it('needs document and address for a boleto', () => {
    const boleto = buildPaymentBody(charge({ method: 'boleto' }), new Date());
    expect(boleto).toMatchObject({
      payment_method_id: 'bolbradesco',
      payer: { address: { zip_code: '30140071', federal_unit: 'MG' } },
    });
    expect(() =>
      buildPaymentBody(charge({ method: 'boleto', payer: { ...PAYER, address: null } }), new Date())
    ).toThrow(/boleto/i);
  });

  it('adds the notification url when the API public url is known', () => {
    process.env.API_PUBLIC_URL = 'https://api.lojageekstore.com/';
    expect(buildPaymentBody(charge(), null)).toMatchObject({
      notification_url: 'https://api.lojageekstore.com/api/webhooks/mercadopago',
    });
  });
});

describe('mercadoPagoProvider.createCharge', () => {
  it('creates the Pix charge with an idempotency key and returns the copy-and-paste code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 987654,
        status: 'pending',
        point_of_interaction: { transaction_data: { qr_code: '000201PIX', qr_code_base64: 'AAA' } },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await mercadoPagoProvider().createCharge(charge());

    expect(result).toMatchObject({
      externalId: '987654',
      status: 'pending',
      details: { pix_code: '000201PIX' },
    });
    expect(result.expiresAt).toBeInstanceOf(Date);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.mercadopago.com/v1/payments');
    expect((init.headers as Record<string, string>)['X-Idempotency-Key']).toBe('key-123456:pix');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TEST-token');
  });

  it('turns a refused card into a declined result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          status: 'rejected',
          status_detail: 'cc_rejected_insufficient_amount',
          payment_method_id: 'visa',
          card: { last_four_digits: '4242' },
        }),
      })
    );
    const result = await mercadoPagoProvider().createCharge(
      charge({ method: 'card', cardToken: 'tok_abc' })
    );
    expect(result.status).toBe('declined');
    expect(result.details).toMatchObject({ brand: 'visa', last4: '4242' });
  });

  it('hides the provider error from the customer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' })
    );
    await expect(mercadoPagoProvider().createCharge(charge())).rejects.toThrow(
      /Não consegui processar o pagamento/
    );
  });

  it('refuses a card charge without a token', async () => {
    await expect(mercadoPagoProvider().createCharge(charge({ method: 'card' }))).rejects.toThrow(
      /cartão/i
    );
  });
});

describe('buildDetails', () => {
  it('shows the boleto line, link and due date', () => {
    expect(
      buildDetails(
        {
          id: 1,
          status: 'pending',
          barcode: { content: '3419' },
          transaction_details: { external_resource_url: 'https://boleto' },
          date_of_expiration: '2026-10-16T23:59:59.000-03:00',
        },
        charge({ method: 'boleto' })
      )
    ).toEqual({ barcode_line: '3419', boleto_url: 'https://boleto', due_date: '2026-10-16' });
  });
});

describe('verifySignature', () => {
  const sign = (id: string, requestId: string, ts: string, secret = 'segredo') =>
    createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');

  it('accepts a valid signature and lowercases alphanumeric ids', () => {
    const v1 = sign('abc123', 'req-1', '1700000000');
    expect(
      verifySignature({
        signatureHeader: `ts=1700000000,v1=${v1}`,
        requestId: 'req-1',
        dataId: 'ABC123',
        secret: 'segredo',
      })
    ).toBe(true);
  });

  it('rejects wrong secret, tampered id, missing header and missing secret', () => {
    const v1 = sign('777', 'req-1', '1700000000');
    const base = { signatureHeader: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '777' };
    expect(verifySignature({ ...base, secret: 'segredo' })).toBe(true);
    expect(verifySignature({ ...base, secret: 'outro' })).toBe(false);
    expect(verifySignature({ ...base, dataId: '778', secret: 'segredo' })).toBe(false);
    expect(verifySignature({ ...base, signatureHeader: undefined, secret: 'segredo' })).toBe(false);
    expect(verifySignature({ ...base, secret: undefined })).toBe(false);
    expect(verifySignature({ ...base, signatureHeader: 'ts=1,v1=zz', secret: 'segredo' })).toBe(
      false
    );
  });
});
