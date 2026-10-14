import { PICKUP_SERVICE_CODE, type ShippingOption, type ShippingQuote } from '@geekstore/shared';

import { envConfig } from '../../core/config/env';
import { configuredShippingProvider } from './melhor-envio';
import type { ProviderOption, ShippingItem, ShippingProvider } from './shipping-provider';
import { FREE_SHIPPING_THRESHOLD_CENTS, quoteShipping } from './shipping-quote';
import { stateOfZip } from './zip-state';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED = 1_000;
const DEFAULT_WEIGHT_G = 300;

const cache = new Map<string, { options: ProviderOption[]; expiresAt: number }>();

export type ShippingQuoteInput = {
  zip: string;
  items: readonly ShippingItem[];
  subtotalCents: number;
  /** Para os testes; por padrão, o provedor do ambiente (ou nenhum). */
  provider?: ShippingProvider | null;
};

const cacheKey = (zip: string, items: readonly ShippingItem[]): string =>
  `${zip}|${items
    .map((i) =>
      [i.quantity, i.weightG, i.lengthMm, i.widthMm, i.heightMm, i.unitPriceCents].join(':')
    )
    .join(',')}`;

async function fromProvider(
  provider: ShippingProvider,
  zip: string,
  items: readonly ShippingItem[]
): Promise<ProviderOption[]> {
  const key = cacheKey(zip, items);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.options;
  const options = await provider.quote({
    fromZip: envConfig.shipping.STORE_ZIP,
    toZip: zip,
    items,
  });
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(key, { options, expiresAt: Date.now() + CACHE_TTL_MS });
  return options;
}

const PICKUP: ShippingOption = {
  code: PICKUP_SERVICE_CODE,
  carrier: 'GeekStore',
  service: 'Retirar na loja (Barretos – SP)',
  price_cents: 0,
  days_min: 1,
  days_max: 2,
  free: false,
  estimated: false,
};

/**
 * Opções de entrega do carrinho: cotação real do provedor (Melhor Envio) e, se ele estiver sem token,
 * fora do ar ou sem atender o CEP, a estimativa por região. Frete grátis por valor mínimo vale para a
 * opção mais barata; a retirada na loja entra sempre.
 */
export async function shippingOptionsFor(input: ShippingQuoteInput): Promise<ShippingQuote> {
  const provider = input.provider === undefined ? configuredShippingProvider() : input.provider;
  if (provider) {
    try {
      const options = await fromProvider(provider, input.zip, input.items);
      if (options.length > 0) return buildQuote(input, options);
    } catch (error) {
      console.error('[frete] cotação real falhou, usando a estimativa:', error);
    }
  }
  return quoteShipping({
    zip: input.zip,
    subtotalCents: input.subtotalCents,
    weightGrams: input.items.reduce(
      (sum, item) => sum + (item.weightG ?? DEFAULT_WEIGHT_G) * item.quantity,
      0
    ),
  });
}

function buildQuote(input: ShippingQuoteInput, providerOptions: ProviderOption[]): ShippingQuote {
  const free = input.subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const cheapest = providerOptions.reduce((best, option) =>
    option.priceCents < best.priceCents ? option : best
  );
  const options: ShippingOption[] = providerOptions.map((option) => {
    const isFree = free && option.code === cheapest.code;
    return {
      code: option.code,
      carrier: option.carrier,
      service: option.service,
      price_cents: isFree ? 0 : option.priceCents,
      days_min: option.daysMin,
      days_max: option.daysMax,
      free: isFree,
      estimated: false,
    };
  });
  return {
    state: stateOfZip(input.zip),
    options: [...options, PICKUP],
    free_shipping_missing_cents: Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - input.subtotalCents),
  };
}

/** Para os testes: esvazia o cache de cotações. */
export function clearShippingCache(): void {
  cache.clear();
}
