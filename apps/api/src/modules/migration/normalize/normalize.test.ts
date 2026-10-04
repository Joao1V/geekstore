import { describe, expect, it } from 'vitest';
import {
  formatBaseCode,
  numberOfBaseCode,
  skuCodeOf,
  variantSuffix,
} from '../../catalog/sku-codes';
import { type ErpRow, erpRowSchema } from '../erp/erp-row';
import { buildPlan } from '../erp/plan';
import { normalizedCatalogSchema } from './catalog-file';
import { detectFranchise } from './franchise';
import { normalizePlan } from './normalize';
import { plainUpper } from './text';

const NOW = new Date('2026-10-04T12:00:00Z');

const row = (codigo: number, nome: string, grupo: string, subgrupo: string): ErpRow =>
  erpRowSchema.parse({
    codigo,
    nome,
    grupo,
    subgrupo,
    preco_venda: 59.9,
    estoque: 2,
    fotos: [`https://cdn.exemplo.com/${codigo}.jpg`],
  });

const rows = [
  row(
    27176,
    'CANECA MINI TINA DREAMWORKS DRAGONS FURIA DA NOITE 100ML',
    'COLECIONÁVEL #',
    'CANECA #'
  ),
  row(
    27177,
    'CANECA MINI TINA DREAMWORKS DRAGONS FURIA DA NOITE 100ML',
    'COLECIONÁVEL #',
    'CANECA #'
  ),
  row(30, 'CAMISETA NARUTO KUNAI PRETO P', 'VESTUÁRIO #', 'CAMISETAS #'),
  row(31, 'CAMISETA NARUTO KUNAI PRETO M', 'VESTUÁRIO #', 'CAMISETAS #'),
  row(40, 'MANGA NARUTO VOL 01', 'LITERATURA #', 'MANGA #'),
];

const normalize = (scope: string[] | null = null) =>
  normalizePlan(buildPlan(rows, { now: NOW }), { now: NOW, sourceSha256: 'abc', scope });

describe('SKU codes', () => {
  it('formats TYPE-NNNNN and appends the variation', () => {
    expect(formatBaseCode('CNC', 42)).toBe('CNC-00042');
    expect(skuCodeOf('CNC-00042', {})).toBe('CNC-00042');
    expect(skuCodeOf('CNC-00042', { capacidade: '100ml' })).toBe('CNC-00042-100ML');
    expect(variantSuffix({ tamanho: 'M', cor: 'Preto' })).toBe('PT-M');
  });

  it('reads the number back from a base code', () => {
    expect(numberOfBaseCode('CNC', 'CNC-00042-100ML')).toBe(42);
    expect(numberOfBaseCode('CNC', 'CAM-00042')).toBeNull();
  });
});

describe('franchise detection', () => {
  it('finds the franchise by name or character, without accents', () => {
    expect(detectFranchise(plainUpper('Caneca Homem-Aranha Marvel'))?.franchise.slug).toBe(
      'marvel'
    );
    expect(detectFranchise(plainUpper('Boneco Pokémon Pikachu'))?.franchise.slug).toBe('pokemon');
    expect(detectFranchise(plainUpper('Caneca Lisa Preta'))).toBeNull();
  });

  it('does not match a keyword inside another word', () => {
    expect(detectFranchise(plainUpper('Mala de Viagem Flashback'))).toBeNull();
  });
});

describe('normalizePlan', () => {
  it('gives every SKU a unique code with no ERP number inside', () => {
    const { catalog } = normalize();
    const codes = catalog.products.flatMap((product) => product.skus.map((sku) => sku.code));
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2,4}-\d{5}(-[A-Z0-9]+)*$/);
    const slugs = catalog.products.map((product) => product.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const text of [...codes, ...slugs]) expect(text).not.toMatch(/2717[67]/);
  });

  it('numbers products per type, in the ERP order', () => {
    const { catalog } = normalize();
    const mugs = catalog.products.filter((product) => product.category === 'canecas');
    expect(mugs.map((product) => product.code)).toEqual(['CNC-00001', 'CNC-00002']);
  });

  it('keeps identical names as two products, never a repeated code', () => {
    const { catalog } = normalize();
    const names = catalog.products.filter((product) => product.name.includes('Tina'));
    expect(names).toHaveLength(2);
    expect(names[0]?.skus[0]?.code).not.toBe(names[1]?.skus[0]?.code);
    expect(names.map((product) => product.slug.replace(/-\d+$/, ''))[1]).toBe(names[0]?.slug);
    expect(names[1]?.slug).toMatch(/-2$/);
  });

  it('groups color/size variations under one product code', () => {
    const { catalog } = normalize();
    const shirt = catalog.products.find((product) => product.category === 'camisetas');
    expect(shirt?.has_variants).toBe(true);
    expect(shirt?.skus.map((sku) => sku.code)).toEqual(['CAM-00001-PT-P', 'CAM-00001-PT-M']);
  });

  it('links the franchise as a collection, not in the SKU', () => {
    const { catalog } = normalize();
    const mug = catalog.products.find((product) => product.category === 'canecas');
    expect(mug?.collections).toEqual(['dreamworks']);
    expect(mug?.skus[0]?.code).toBe('CNC-00001-100ML');
  });

  it('keeps the ERP link in a separate map', () => {
    const { legacyMap } = normalize();
    expect(legacyMap.find((entry) => entry.erp_code === '27176')?.sku_code).toMatch(/^CNC-/);
    expect(legacyMap).toHaveLength(5);
  });

  it('limits the output to the pilot scope and still validates against the file schema', () => {
    const result = normalize(['camisetas']);
    expect(result.catalog.products.every((product) => product.category === 'camisetas')).toBe(true);
    expect(normalizedCatalogSchema.safeParse(result.catalog).success).toBe(true);
    expect(result.lastNumbers).toEqual({ CAM: 1 });
  });

  it('continues numbering after the last number already used', () => {
    const result = normalizePlan(buildPlan(rows, { now: NOW }), {
      now: NOW,
      sourceSha256: 'abc',
      scope: ['canecas'],
      startAfter: { CNC: 99 },
    });
    expect(result.catalog.products[0]?.code).toBe('CNC-00100');
  });
});
