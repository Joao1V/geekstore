import { formatBRL } from '@geekstore/shared';

export { formatBRL };

// Condições comerciais de EXEMPLO da vitrine (a regra real vem na F3, com o gateway):
// 5% de desconto no Pix, parcelamento em 6x sem juros e frete grátis acima de R$ 299.
const PIX_DISCOUNT_PERCENT = 5;
export const INSTALLMENTS = 6;
export const FREE_SHIPPING_MIN_CENTS = 29_900;
const MIN_INSTALLMENT_CENTS = 2_000; // parcela mínima de R$ 20

/** Preço no Pix, em centavos inteiros. */
export function pixCents(cents: number): number {
  return Math.round((cents * (100 - PIX_DISCOUNT_PERCENT)) / 100);
}

/** Percentual de desconto de "de/por" (11990 -> 8990 = 25). */
export function discountPercent(priceCents: number, compareAtCents: number): number {
  return Math.round((1 - priceCents / compareAtCents) * 100);
}

export type InstallmentPlan = { count: number; valueCents: number };

/**
 * Parcelamento sem juros: até 6x, com parcela mínima de R$ 20 (regra de EXEMPLO; a real vem do
 * gateway na F3). Preço baixo demais para parcelar devolve `null` (sem destaque de "sem juros").
 */
export function installmentPlan(priceCents: number): InstallmentPlan | null {
  const count = Math.min(INSTALLMENTS, Math.floor(priceCents / MIN_INSTALLMENT_CENTS));
  return count >= 2 ? { count, valueCents: Math.round(priceCents / count) } : null;
}
