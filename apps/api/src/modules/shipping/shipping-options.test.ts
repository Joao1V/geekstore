import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProducts, parseServices } from './melhor-envio';
import { clearShippingCache, shippingOptionsFor } from './shipping-options';
import type { ProviderOption, ShippingItem, ShippingProvider } from './shipping-provider';
import { FREE_SHIPPING_THRESHOLD_CENTS } from './shipping-quote';

const item = (over: Partial<ShippingItem> = {}): ShippingItem => ({
  quantity: 1,
  unitPriceCents: 5_000,
  weightG: 400,
  lengthMm: 200,
  widthMm: 120,
  heightMm: 30,
  ...over,
});

const OPTIONS: ProviderOption[] = [
  {
    code: 'me:2',
    carrier: 'Correios',
    service: 'SEDEX',
    priceCents: 3_200,
    daysMin: 1,
    daysMax: 3,
  },
  { code: 'me:1', carrier: 'Correios', service: 'PAC', priceCents: 1_850, daysMin: 4, daysMax: 7 },
];
const providerOf = (quote: ShippingProvider['quote']): ShippingProvider => ({
  name: 'fake',
  quote,
});

describe('Melhor Envio parsing', () => {
  it('turns the services into options, cheapest first, skipping the ones with error', () => {
    const options = parseServices([
      {
        id: 2,
        name: 'SEDEX',
        price: '32.00',
        delivery_range: { min: 1, max: 3 },
        company: { name: 'Correios' },
      },
      { id: 3, name: '.Package', error: 'Serviço indisponível', company: { name: 'Jadlog' } },
      {
        id: 1,
        name: 'PAC',
        price: '18.50',
        custom_price: '19.10',
        delivery_time: 6,
        company: { name: 'Correios' },
      },
    ]);
    expect(options.map((o) => o.code)).toEqual(['me:1', 'me:2']);
    // custom_price vale mais que price; sem faixa de prazo usa o prazo único.
    expect(options[0]).toMatchObject({ priceCents: 1_910, daysMin: 6, daysMax: 6 });
  });

  it('sends cm, kg and the declared value, with Correios minimums for unknown measures', () => {
    const [known, unknown] = buildProducts([
      item(),
      item({ lengthMm: null, widthMm: null, heightMm: null, weightG: null }),
    ]);
    expect(known).toMatchObject({
      length: 20,
      width: 12,
      height: 3,
      weight: 0.4,
      insurance_value: 50,
    });
    expect(unknown).toMatchObject({ length: 16, width: 11, height: 2, weight: 0.3 });
  });
});

describe('shippingOptionsFor', () => {
  beforeEach(() => {
    clearShippingCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('lists the provider options plus pickup, none of them estimated', async () => {
    const quote = vi.fn().mockResolvedValue(OPTIONS);
    const result = await shippingOptionsFor({
      zip: '30140071',
      items: [item()],
      subtotalCents: 5_000,
      provider: providerOf(quote),
    });
    expect(result.options.map((o) => o.code)).toEqual(['me:2', 'me:1', 'pickup']);
    expect(result.options.every((o) => !o.estimated)).toBe(true);
    expect(quote).toHaveBeenCalledWith(expect.objectContaining({ toZip: '30140071' }));
  });

  it('gives free shipping to the cheapest option from the minimum order', async () => {
    const result = await shippingOptionsFor({
      zip: '30140071',
      items: [item()],
      subtotalCents: FREE_SHIPPING_THRESHOLD_CENTS,
      provider: providerOf(vi.fn().mockResolvedValue(OPTIONS)),
    });
    expect(result.options.find((o) => o.code === 'me:1')).toMatchObject({
      price_cents: 0,
      free: true,
    });
    expect(result.options.find((o) => o.code === 'me:2')?.price_cents).toBe(3_200);
    expect(result.free_shipping_missing_cents).toBe(0);
  });

  it('answers repeated quotes from the cache', async () => {
    const quote = vi.fn().mockResolvedValue(OPTIONS);
    const input = { zip: '30140071', items: [item()], subtotalCents: 5_000 };
    await shippingOptionsFor({ ...input, provider: providerOf(quote) });
    await shippingOptionsFor({ ...input, provider: providerOf(quote) });
    expect(quote).toHaveBeenCalledTimes(1);
  });

  it('falls back to the regional estimate when the provider fails or has no options', async () => {
    const failing = await shippingOptionsFor({
      zip: '30140071',
      items: [item()],
      subtotalCents: 5_000,
      provider: providerOf(vi.fn().mockRejectedValue(new Error('timeout'))),
    });
    expect(failing.options.find((o) => o.code === 'standard')?.estimated).toBe(true);
    expect(failing.options.find((o) => o.code === 'pickup')).toBeDefined();

    clearShippingCache();
    const empty = await shippingOptionsFor({
      zip: '30140071',
      items: [item()],
      subtotalCents: 5_000,
      provider: providerOf(vi.fn().mockResolvedValue([])),
    });
    expect(empty.options.some((o) => o.estimated)).toBe(true);
  });

  it('uses the estimate when there is no provider', async () => {
    const result = await shippingOptionsFor({
      zip: '30140071',
      items: [item()],
      subtotalCents: 5_000,
      provider: null,
    });
    expect(result.options.map((o) => o.code)).toEqual(['standard', 'express', 'pickup']);
  });
});
