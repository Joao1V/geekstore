import { formatBRL } from '@geekstore/shared';

export { formatBRL };

// Condições comerciais de EXEMPLO da vitrine (a regra real vem na F3, com o gateway):
// 5% de desconto no Pix, parcelamento em 6x sem juros e frete grátis acima de R$ 299.
const PIX_DISCOUNT_PERCENT = 5;
export const INSTALLMENTS = 6;
export const FREE_SHIPPING_MIN_CENTS = 29_900;

/** Preço no Pix, em centavos inteiros. */
export function pixCents(cents: number): number {
  return Math.round((cents * (100 - PIX_DISCOUNT_PERCENT)) / 100);
}

/** Percentual de desconto de "de/por" (11990 -> 8990 = 25). */
export function discountPercent(priceCents: number, compareAtCents: number): number {
  return Math.round((1 - priceCents / compareAtCents) * 100);
}
