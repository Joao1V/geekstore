// Mercado Pago no navegador (RNF-07): o cartão vira um token direto no Mercado Pago e só o token
// viaja para a nossa API. Sem `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` o checkout usa o pagamento simulado.

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const BIN_DIGITS = 8;

export const MERCADOPAGO_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? '';
export const PAYMENTS_ARE_REAL = MERCADOPAGO_PUBLIC_KEY !== '';

type CardTokenInput = {
  cardNumber: string;
  cardholderName: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  securityCode: string;
  identificationType: 'CPF' | 'CNPJ';
  identificationNumber: string;
};
type PaymentMethodResult = { results: Array<{ id: string; issuer?: { id: string | number } }> };
type MercadoPagoClient = {
  createCardToken(input: CardTokenInput): Promise<{ id: string }>;
  getPaymentMethods(input: { bin: string }): Promise<PaymentMethodResult>;
};
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale: string }) => MercadoPagoClient;
  }
}

let sdkPromise: Promise<MercadoPagoClient> | null = null;

/** Carrega o SDK do Mercado Pago uma única vez. */
function loadClient(): Promise<MercadoPagoClient> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<MercadoPagoClient>((resolve, reject) => {
    const create = () => {
      if (!window.MercadoPago) return reject(new Error('Mercado Pago indisponível'));
      resolve(new window.MercadoPago(MERCADOPAGO_PUBLIC_KEY, { locale: 'pt-BR' }));
    };
    if (window.MercadoPago) return create();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = create;
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Não consegui carregar o pagamento seguro. Tente de novo.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export type TokenizedCard = { token: string; paymentMethodId?: string; issuerId?: string };

export async function tokenizeCard(card: {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
  document: string;
}): Promise<TokenizedCard> {
  const client = await loadClient();
  const digits = card.number.replace(/\D/g, '');
  const expiry = card.expiry.replace(/\D/g, '');
  const document = card.document.replace(/\D/g, '');
  const [token, methods] = await Promise.all([
    client.createCardToken({
      cardNumber: digits,
      cardholderName: card.holder.trim(),
      cardExpirationMonth: expiry.slice(0, 2),
      cardExpirationYear: `20${expiry.slice(2, 4)}`,
      securityCode: card.cvv.trim(),
      identificationType: document.length > 11 ? 'CNPJ' : 'CPF',
      identificationNumber: document,
    }),
    client.getPaymentMethods({ bin: digits.slice(0, BIN_DIGITS) }).catch(() => null),
  ]);
  const method = methods?.results[0];
  return {
    token: token.id,
    paymentMethodId: method?.id,
    issuerId: method?.issuer ? String(method.issuer.id) : undefined,
  };
}
