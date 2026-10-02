import { describe, expect, it } from 'vitest';

import { type ErpRow, erpRowSchema } from './erp-row';
import { chunkByProduct } from './load-batch';
import { buildPlan } from './plan';
import type { PlannedItem } from './plan-types';
import { familyPrefix, variantCode } from './sku-code';

const NOW = new Date('2026-10-02T12:00:00Z');

const shirt = (codigo: number, nome: string, overrides: Record<string, unknown> = {}): ErpRow =>
  erpRowSchema.parse({
    codigo,
    nome,
    grupo: 'VESTUÁRIO #',
    subgrupo: 'CAMISETAS #',
    preco_venda: 89.9,
    estoque: 3,
    fotos: [`https://cdn.exemplo.com/${codigo}.jpg`],
    ...overrides,
  });

const plan = (rows: ErpRow[]) => buildPlan(rows, { now: NOW });

describe('SKU codes', () => {
  it('builds the family prefix from the line, skipping the garment type', () => {
    expect(familyPrefix('Camiseta Naruto Kunai')).toBe('NAR-KUN');
    expect(familyPrefix('Camiseta Naruto')).toBe('NAR');
    expect(variantCode('NAR', { cor: 'Preto', tamanho: 'P' })).toBe('NAR-PRE-P');
    expect(variantCode('NAR', { cor: 'Branco', tamanho: 'P' })).toBe('NAR-BRA-P');
    expect(variantCode('PAN', { tamanho: 'G', numeracao: '39/41' })).toBe('PAN-G-39-41');
  });
});

describe('buildPlan: variations', () => {
  const rows = [
    shirt(1, 'CAMISETA NARUTO PRETO P'),
    shirt(2, 'CAMISETA NARUTO PRETO M #3520'),
    shirt(3, 'CAMISETA NARUTO BRANCO P'),
    shirt(4, 'CAMISETA NARUTO AZUL MARINHO GG', { estoque: 0 }),
  ];

  it('groups colour and size variants into one product with a readable SKU each', () => {
    const { items } = plan(rows);
    expect(new Set(items.map((i) => i.productKey)).size).toBe(1);
    expect(items.map((i) => i.name)).toEqual(Array(4).fill('Camiseta Naruto'));
    expect(items.map((i) => [i.skuCode, i.attributes])).toEqual([
      ['NAR-PRE-P', { cor: 'Preto', tamanho: 'P' }],
      ['NAR-PRE-M', { cor: 'Preto', tamanho: 'M' }],
      ['NAR-BRA-P', { cor: 'Branco', tamanho: 'P' }],
      ['NAR-AZM-GG', { cor: 'Azul Marinho', tamanho: 'GG' }],
    ]);
    expect(items.map((i) => i.legacyCode)).toEqual(['1', '2', '3', '4']); // código do ERP preservado
  });

  it('shares slug, photos and status across the variants (active if any SKU sells)', () => {
    const { items } = plan(rows);
    expect(new Set(items.map((i) => i.slug))).toEqual(new Set(['camiseta-naruto']));
    expect(items[0]?.photos).toHaveLength(4);
    expect(items.every((i) => i.productStatus === 'active')).toBe(true);
    expect(items[3]?.skuStatus).toBe('inactive');
  });

  it('keeps unrelated items as simple products, with GROUP-ERPCODE SKUs', () => {
    const { items } = plan([
      shirt(10, 'CAMISETA SEM TAMANHO'),
      shirt(11, 'CAMISETA NARUTO PRETO P'),
    ]);
    expect(items.map((i) => i.skuCode)).toEqual(['VES-10', 'VES-11']);
    expect(items.every((i) => Object.keys(i.attributes).length === 0)).toBe(true);
  });

  it('does not group a family with two identical variants; it reports it for review', () => {
    const result = plan([
      shirt(20, 'CAMISETA NARUTO PRETO P'),
      shirt(21, 'CAMISETA NARUTO PRETO P'),
    ]);
    expect(new Set(result.items.map((i) => i.productKey)).size).toBe(2);
    expect(result.issues.filter((i) => i.code === 'variant_ambiguous')).toHaveLength(2);
  });

  it('keeps SKU codes and prefixes unique across families and against the database', () => {
    const rowsB = [
      shirt(30, 'CAMISETA NARUTO PRETO P', { subgrupo: 'OUTRA #' }),
      shirt(31, 'CAMISETA NARUTO PRETO M', { subgrupo: 'OUTRA #' }),
    ];
    const result = buildPlan([...rows, ...rowsB], {
      now: NOW,
      takenSkuCodes: new Set(['NAR-PRE-GG']),
    });
    const codes = result.items.map((i) => i.skuCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('NAR2-PRE-P'); // segunda família "Camiseta Naruto"
  });
});

describe('buildPlan: colour values', () => {
  it('uses one canonical value for masculine and feminine colours', () => {
    const { items } = plan([
      shirt(50, 'CAMISETA ZETA PRETA P'),
      shirt(51, 'CAMISETA ZETA PRETO M'),
    ]);
    expect(items.map((i) => i.attributes.cor)).toEqual(['Preto', 'Preto']);
  });
});

describe('buildPlan: size labels', () => {
  it('drops the word "Tamanho" from the product name', () => {
    const { items } = plan([
      shirt(40, 'FANTASIA SEREIA VERDE TAMANHO P'),
      shirt(41, 'FANTASIA SEREIA VERDE TAMANHO M'),
    ]);
    expect(items.map((i) => i.name)).toEqual(['Fantasia Sereia', 'Fantasia Sereia']);
  });
});

describe('chunkByProduct', () => {
  const item = (productKey: string, n: number) =>
    ({ productKey, legacyCode: String(n) }) as PlannedItem;

  it('never splits the variants of a product across batches', () => {
    const items = [item('a', 1), item('b', 2), item('b', 3), item('b', 4), item('c', 5)];
    const batches = chunkByProduct(items, 2);
    expect(batches.map((batch) => batch.map((i) => i.productKey))).toEqual([
      ['a', 'b', 'b', 'b'],
      ['c'],
    ]);
  });

  it('returns no batches for no items', () => {
    expect(chunkByProduct([], 500)).toEqual([]);
  });
});
