import type { ShippingOption, ShippingQuote } from '@geekstore/shared';

import { stateOfZip } from './zip-state';

// Cotação SIMULADA (RF-FRT-01 pede um agregador, como o Melhor Envio; troca-se esta função por ele).
// Preço pela região do destino em relação à loja (Barretos, SP) e pelo peso.
export const STORE_STATE = 'SP';
export const FREE_SHIPPING_THRESHOLD_CENTS = 29_900;
const DEFAULT_WEIGHT_G = 300;
const PACKAGING_G = 100;
const EXTRA_PER_KG_CENTS = 390;
const EXPRESS_FACTOR = 1.6;
const GRAMS_PER_KG = 1000;

type Region = { price: number; min: number; max: number };

const SAME_STATE: Region = { price: 1290, min: 2, max: 4 };
const SOUTHEAST: Region = { price: 1590, min: 3, max: 5 };
const SOUTH_CENTER_WEST: Region = { price: 1890, min: 4, max: 7 };
const NORTHEAST: Region = { price: 2290, min: 6, max: 10 };
const NORTH: Region = { price: 2790, min: 8, max: 14 };

const REGION_OF_STATE: Record<string, Region> = {
  SP: SAME_STATE,
  RJ: SOUTHEAST,
  MG: SOUTHEAST,
  ES: SOUTHEAST,
  PR: SOUTH_CENTER_WEST,
  SC: SOUTH_CENTER_WEST,
  RS: SOUTH_CENTER_WEST,
  DF: SOUTH_CENTER_WEST,
  GO: SOUTH_CENTER_WEST,
  MT: SOUTH_CENTER_WEST,
  MS: SOUTH_CENTER_WEST,
  BA: NORTHEAST,
  SE: NORTHEAST,
  AL: NORTHEAST,
  PE: NORTHEAST,
  PB: NORTHEAST,
  RN: NORTHEAST,
  CE: NORTHEAST,
  PI: NORTHEAST,
  MA: NORTHEAST,
  PA: NORTH,
  AP: NORTH,
  AM: NORTH,
  RR: NORTH,
  AC: NORTH,
  RO: NORTH,
  TO: NORTH,
};

export type QuoteInput = { zip: string; subtotalCents: number; weightGrams: number | null };

/** Custo do envio padrão: preço da região mais um adicional por kg que passar de 1 kg. */
function standardPrice(region: Region, weightGrams: number | null): number {
  const grams = (weightGrams ?? DEFAULT_WEIGHT_G) + PACKAGING_G;
  const extraKg = Math.max(0, Math.ceil(grams / GRAMS_PER_KG) - 1);
  return region.price + extraKg * EXTRA_PER_KG_CENTS;
}

export function quoteShipping(input: QuoteInput): ShippingQuote {
  const state = stateOfZip(input.zip);
  const region = (state ? REGION_OF_STATE[state] : undefined) ?? NORTH;
  const base = standardPrice(region, input.weightGrams);
  const free = input.subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;

  const standard: ShippingOption = {
    code: 'standard',
    carrier: 'Correios (simulado)',
    service: 'PAC',
    price_cents: free ? 0 : base,
    days_min: region.min,
    days_max: region.max,
    free,
  };
  const express: ShippingOption = {
    code: 'express',
    carrier: 'Correios (simulado)',
    service: 'SEDEX',
    price_cents: Math.round(base * EXPRESS_FACTOR),
    days_min: Math.max(1, Math.floor(region.min / 2)),
    days_max: Math.max(2, Math.floor(region.max / 2)),
    free: false,
  };
  const pickup: ShippingOption = {
    code: 'pickup',
    carrier: 'GeekStore',
    service: 'Retirar na loja (Barretos – SP)',
    price_cents: 0,
    days_min: 1,
    days_max: 2,
    free: false,
  };
  return {
    state,
    options: [standard, express, pickup],
    free_shipping_missing_cents: Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - input.subtotalCents),
  };
}
