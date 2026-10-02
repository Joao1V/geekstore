import { describe, expect, it } from 'vitest';

import {
  axesFromSkus,
  combinationKey,
  combinations,
  type GridAttributeDefinition,
  mergeGrid,
  suggestProductCode,
  suggestSkuCode,
} from './grid';

const definitions: GridAttributeDefinition[] = [
  {
    code: 'cor',
    values: [
      { code: 'preto', sku_suffix: 'PT' },
      { code: 'azul-marinho', sku_suffix: 'MR' },
    ],
  },
  {
    code: 'tamanho',
    values: [
      { code: 'm', sku_suffix: 'M' },
      { code: 'gg', sku_suffix: 'GG' },
    ],
  },
  { code: 'numeracao', values: [{ code: '33-35', sku_suffix: '33-35' }] },
];

describe('combinations', () => {
  it('builds the cartesian product in the order the axes were chosen', () => {
    expect(
      combinations([
        { attribute: 'cor', values: ['preto', 'azul'] },
        { attribute: 'tamanho', values: ['p', 'm', 'g'] },
      ])
    ).toHaveLength(6);
    expect(
      combinations([
        { attribute: 'cor', values: ['preto', 'azul'] },
        { attribute: 'tamanho', values: ['p', 'm'] },
      ])
    ).toEqual([
      { cor: 'preto', tamanho: 'p' },
      { cor: 'preto', tamanho: 'm' },
      { cor: 'azul', tamanho: 'p' },
      { cor: 'azul', tamanho: 'm' },
    ]);
  });

  it('ignores an axis with no values instead of emptying the grid', () => {
    expect(
      combinations([
        { attribute: 'cor', values: ['preto'] },
        { attribute: 'tamanho', values: [] },
      ])
    ).toEqual([{ cor: 'preto' }]);
  });

  it('has no combination without any chosen value', () => {
    expect(combinations([])).toEqual([]);
    expect(combinations([{ attribute: 'cor', values: [] }])).toEqual([]);
  });
});

describe('suggestSkuCode', () => {
  it('joins the product code with the value suffixes, in the axes order', () => {
    expect(
      suggestSkuCode('cam-naruto', { cor: 'preto', tamanho: 'm' }, ['cor', 'tamanho'], definitions)
    ).toBe('CAM-NARUTO-PT-M');
    expect(
      suggestSkuCode('CAM-NARUTO', { cor: 'preto', tamanho: 'm' }, ['tamanho', 'cor'], definitions)
    ).toBe('CAM-NARUTO-M-PT');
  });

  it('uses the registered suffix, cleans odd characters and falls back to the value code', () => {
    expect(suggestSkuCode('PAN', { numeracao: '33-35' }, ['numeracao'], definitions)).toBe(
      'PAN-33-35'
    );
    expect(suggestSkuCode('X', { cor: 'turquesa' }, ['cor'], definitions)).toBe('X-TURQUESA');
    expect(suggestSkuCode('X', {}, [], definitions)).toBe('X');
  });
});

describe('combinationKey', () => {
  it('does not depend on the attribute order or on empty values', () => {
    expect(combinationKey({ tamanho: 'm', cor: 'preto' })).toBe(
      combinationKey({ cor: 'preto', tamanho: 'm', sabor: '' })
    );
  });
});

describe('mergeGrid', () => {
  type Row = { sku_id: string | null; attributes: Record<string, string>; code: string };
  const make = (attributes: Record<string, string>): Row => ({
    sku_id: null,
    attributes,
    code: `NEW-${combinationKey(attributes)}`,
  });

  it('keeps typed rows, adds the missing combinations and drops new rows that left the grid', () => {
    const current: Row[] = [
      { sku_id: null, attributes: { cor: 'preto' }, code: 'EDITADO' },
      { sku_id: null, attributes: { cor: 'azul' }, code: 'SAIU' },
    ];
    const merged = mergeGrid(current, [{ cor: 'preto' }, { cor: 'verde' }], make);
    expect(merged.map((r) => r.code)).toEqual(['EDITADO', 'NEW-cor=verde']);
  });

  it('never drops a SKU that already exists, even if its combination left the grid', () => {
    const current: Row[] = [{ sku_id: 'abc', attributes: { cor: 'azul' }, code: 'EXISTENTE' }];
    const merged = mergeGrid(current, [{ cor: 'preto' }], make);
    expect(merged.map((r) => r.code)).toEqual(['NEW-cor=preto', 'EXISTENTE']);
  });
});

describe('axesFromSkus', () => {
  it('lists the attributes in use and their distinct values, in order of appearance', () => {
    expect(
      axesFromSkus([
        { attributes: { cor: 'preto', tamanho: 'm' } },
        { attributes: { cor: 'preto', tamanho: 'g' } },
        { attributes: { cor: 'azul', tamanho: 'm' } },
      ])
    ).toEqual([
      { attribute: 'cor', values: ['preto', 'azul'] },
      { attribute: 'tamanho', values: ['m', 'g'] },
    ]);
    expect(axesFromSkus([{ attributes: {} }])).toEqual([]);
  });
});

describe('suggestProductCode', () => {
  it('takes 3 letters from the first two meaningful words', () => {
    expect(suggestProductCode('Camiseta Naruto Kunai')).toBe('CAM-NAR');
    expect(suggestProductCode('Funko Pop! Pokémon Pikachu')).toBe('FUN-POP');
    expect(suggestProductCode('Jogo de Tabuleiro Catan')).toBe('JOG-TAB');
  });

  it('copes with short, empty and accented names', () => {
    expect(suggestProductCode('Uno')).toBe('UNO');
    expect(suggestProductCode('   ')).toBe('');
    expect(suggestProductCode('Ação & Aventura')).toBe('ACA-AVE');
  });
});
