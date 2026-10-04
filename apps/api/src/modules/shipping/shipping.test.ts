import { afterEach, describe, expect, it, vi } from 'vitest';

import { FREE_SHIPPING_THRESHOLD_CENTS, quoteShipping } from './shipping-quote';
import { clearZipCache, lookupZip } from './zip.service';
import { stateOfZip } from './zip-state';

describe('stateOfZip', () => {
  it('maps CEP ranges to states, with or without a dash', () => {
    expect(stateOfZip('14780-000')).toBe('SP');
    expect(stateOfZip('20040020')).toBe('RJ');
    expect(stateOfZip('30140071')).toBe('MG');
    expect(stateOfZip('70040010')).toBe('DF');
    expect(stateOfZip('88010000')).toBe('SC');
    expect(stateOfZip('69900000')).toBe('AC');
  });

  it('returns null for something that is not a CEP', () => {
    expect(stateOfZip('123')).toBeNull();
    expect(stateOfZip('00000000')).toBeNull();
  });
});

describe('quoteShipping', () => {
  const quote = (zip: string, subtotalCents = 5_000, weightGrams: number | null = 300) =>
    quoteShipping({ zip, subtotalCents, weightGrams });
  const price = (
    zip: string,
    code: 'standard' | 'express' | 'pickup',
    subtotal = 5_000,
    weight = 300
  ) => quote(zip, subtotal, weight).options.find((option) => option.code === code)?.price_cents;

  it('charges by region: nearer is cheaper', () => {
    expect(price('14780000', 'standard')).toBeLessThan(price('30140071', 'standard') ?? 0);
    expect(price('30140071', 'standard')).toBeLessThan(price('50010000', 'standard') ?? 0);
    expect(price('50010000', 'standard')).toBeLessThan(price('69900000', 'standard') ?? 0);
  });

  it('adds a surcharge per kilo above the first one', () => {
    const light = price('14780000', 'standard', 5_000, 300) ?? 0;
    const heavy = price('14780000', 'standard', 5_000, 2_500) ?? 0;
    expect(heavy).toBeGreaterThan(light);
  });

  it('makes express faster and dearer, and pickup free', () => {
    const { options } = quote('30140071');
    const standard = options.find((o) => o.code === 'standard');
    const express = options.find((o) => o.code === 'express');
    expect(express?.price_cents).toBeGreaterThan(standard?.price_cents ?? 0);
    expect(express?.days_max).toBeLessThanOrEqual(standard?.days_max ?? 0);
    expect(options.find((o) => o.code === 'pickup')?.price_cents).toBe(0);
  });

  it('makes the standard shipping free from the minimum order, and says how much is missing before', () => {
    const below = quote('30140071', FREE_SHIPPING_THRESHOLD_CENTS - 100);
    expect(below.free_shipping_missing_cents).toBe(100);
    expect(below.options[0]?.free).toBe(false);
    const reached = quote('30140071', FREE_SHIPPING_THRESHOLD_CENTS);
    expect(reached.free_shipping_missing_cents).toBe(0);
    expect(reached.options[0]).toMatchObject({ code: 'standard', price_cents: 0, free: true });
    expect(reached.options.find((o) => o.code === 'express')?.price_cents).toBeGreaterThan(0);
  });

  it('treats an unknown region like the farthest one', () => {
    expect(price('00000000', 'standard')).toBe(price('69900000', 'standard'));
  });
});

describe('lookupZip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearZipCache();
  });
  const stub = (body: unknown, ok = true) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('reads the address and caches the answer', async () => {
    const fetchMock = stub({
      logradouro: 'Rua das Flores',
      bairro: 'Centro',
      localidade: 'Barretos',
      uf: 'SP',
    });
    const first = await lookupZip('14780000');
    expect(first).toEqual({
      zip: '14780000',
      street: 'Rua das Flores',
      neighborhood: 'Centro',
      city: 'Barretos',
      state: 'SP',
    });
    await lookupZip('14780000');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says so when the CEP does not exist or the service fails', async () => {
    stub({ erro: true });
    await expect(lookupZip('99999999')).rejects.toThrow(/não encontrado/i);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(lookupZip('88888888')).rejects.toThrow(/Preencha o endereço/);
  });
});
