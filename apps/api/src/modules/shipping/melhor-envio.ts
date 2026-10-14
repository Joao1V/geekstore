import { envConfig } from '../../core/config/env';
import type {
  ProviderOption,
  ProviderQuoteInput,
  ShippingItem,
  ShippingProvider,
} from './shipping-provider';

const URLS = {
  production: 'https://melhorenvio.com.br',
  sandbox: 'https://sandbox.melhorenvio.com.br',
} as const;
const TIMEOUT_MS = 6_000;
const MM_PER_CM = 10;
const G_PER_KG = 1000;
const CENTS_PER_REAL = 100;

// Mínimos aceitos pelos Correios, usados quando o SKU não tem medidas cadastradas.
const DEFAULT_LENGTH_CM = 16;
const DEFAULT_WIDTH_CM = 11;
const DEFAULT_HEIGHT_CM = 2;
const DEFAULT_WEIGHT_G = 300;

type MelhorEnvioService = {
  id: number;
  name: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  custom_delivery_range?: { min: number; max: number };
  error?: string;
  company?: { name?: string };
};

const toCm = (mm: number | null, fallback: number): number =>
  mm && mm > 0 ? Math.max(1, Math.ceil(mm / MM_PER_CM)) : fallback;

/** Corpo da cotação: o Melhor Envio monta as caixas a partir da lista de produtos. */
export function buildProducts(items: readonly ShippingItem[]) {
  return items.map((item, index) => ({
    id: String(index + 1),
    width: toCm(item.widthMm, DEFAULT_WIDTH_CM),
    height: toCm(item.heightMm, DEFAULT_HEIGHT_CM),
    length: toCm(item.lengthMm, DEFAULT_LENGTH_CM),
    weight: (item.weightG ?? DEFAULT_WEIGHT_G) / G_PER_KG,
    // Seguro pelo valor declarado do item.
    insurance_value: item.unitPriceCents / CENTS_PER_REAL,
    quantity: item.quantity,
  }));
}

const toCents = (value: string | number | undefined): number | null => {
  const reais = typeof value === 'string' ? Number.parseFloat(value) : value;
  return reais === undefined || Number.isNaN(reais) ? null : Math.round(reais * CENTS_PER_REAL);
};

/** Lê a resposta do Melhor Envio, descartando os serviços que não atendem o trecho. */
export function parseServices(services: readonly MelhorEnvioService[]): ProviderOption[] {
  const options: ProviderOption[] = [];
  for (const service of services) {
    if (service.error) continue;
    const priceCents = toCents(service.custom_price ?? service.price);
    if (priceCents === null) continue;
    const range = service.custom_delivery_range ?? service.delivery_range;
    const days = service.delivery_time;
    const daysMin = range?.min ?? days;
    const daysMax = range?.max ?? days;
    if (daysMin === undefined || daysMax === undefined) continue;
    options.push({
      code: `me:${service.id}`,
      carrier: service.company?.name ?? 'Transportadora',
      service: service.name.replace(/^\./, ''),
      priceCents,
      daysMin,
      daysMax,
    });
  }
  return options.sort((a, b) => a.priceCents - b.priceCents);
}

export class ShippingProviderError extends Error {}

/** Cotação real (Correios, Jadlog, Loggi...) pelo agregador Melhor Envio. */
export function createMelhorEnvioProvider(
  token: string,
  environment: keyof typeof URLS,
  contactEmail?: string
): ShippingProvider {
  return {
    name: 'melhor-envio',
    async quote(input: ProviderQuoteInput) {
      const response = await fetch(`${URLS[environment]}/api/v2/me/shipment/calculate`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': `GeekStore (${contactEmail ?? 'contato@lojageekstore.com'})`,
        },
        body: JSON.stringify({
          from: { postal_code: input.fromZip },
          to: { postal_code: input.toZip },
          products: buildProducts(input.items),
        }),
      });
      if (!response.ok)
        throw new ShippingProviderError(`Melhor Envio respondeu ${response.status}`);
      const body = (await response.json()) as unknown;
      if (!Array.isArray(body))
        throw new ShippingProviderError('Resposta inesperada do Melhor Envio');
      return parseServices(body as MelhorEnvioService[]);
    },
  };
}

/** O provedor configurado no ambiente, ou `null` quando não há token (usa a estimativa). */
export function configuredShippingProvider(): ShippingProvider | null {
  const { MELHOR_ENVIO_TOKEN, MELHOR_ENVIO_ENV, MELHOR_ENVIO_CONTACT_EMAIL } = envConfig.shipping;
  if (!MELHOR_ENVIO_TOKEN) return null;
  return createMelhorEnvioProvider(
    MELHOR_ENVIO_TOKEN,
    MELHOR_ENVIO_ENV,
    MELHOR_ENVIO_CONTACT_EMAIL
  );
}
