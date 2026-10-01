import { type SkuGridRow, toCents } from '@geekstore/shared';

/** Edição pendente de uma linha da grade: o que foi digitado + o valor original (para comparar). */
export type RowEdit = { base: SkuGridRow; price?: string; on_hand?: string };
export type EditMap = Record<string, RowEdit>;

const PRICE_PATTERN = /^\d{1,9}(?:[.,]\d{1,2})?$/;
const INTEGER_PATTERN = /^\d{1,9}$/;

/** Reais digitados ("349,90" ou "349.90", sem separador de milhar) para centavos; null se inválido. */
export function parsePriceCents(text: string): number | null {
  const trimmed = text.trim();
  if (!PRICE_PATTERN.test(trimmed)) return null;
  return toCents(Number(trimmed.replace(',', '.')));
}

export function parseOnHand(text: string): number | null {
  const trimmed = text.trim();
  return INTEGER_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

export function formatPriceInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

export type RowState = {
  priceCents: number | null;
  onHand: number | null;
  priceDirty: boolean;
  priceInvalid: boolean;
  stockDirty: boolean;
  stockInvalid: boolean;
};

export function rowState(edit: RowEdit): RowState {
  const { base } = edit;
  let priceCents: number | null = null;
  let priceDirty = false;
  let priceInvalid = false;
  if (edit.price !== undefined) {
    priceCents = parsePriceCents(edit.price);
    // Sem preço cadastrado, campo vazio = sem alteração; com preço, não dá para "limpar".
    const isUntouchedEmpty = edit.price.trim() === '' && base.price_cents === null;
    priceInvalid = priceCents === null && !isUntouchedEmpty;
    priceDirty = priceCents !== null && priceCents !== base.price_cents;
  }
  let onHand: number | null = null;
  let stockDirty = false;
  let stockInvalid = false;
  if (edit.on_hand !== undefined) {
    onHand = parseOnHand(edit.on_hand);
    stockInvalid = onHand === null;
    stockDirty = onHand !== null && onHand !== base.on_hand;
  }
  return { priceCents, onHand, priceDirty, priceInvalid, stockDirty, stockInvalid };
}
