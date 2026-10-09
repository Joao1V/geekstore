import { describe, expect, it } from 'vitest';

import { type PlanProduct, parseName, planFamilies, takeStyle } from './families';
import { desiredSkuCode } from './families.service';

const product = (
  code: string,
  name: string,
  skus: { attrs?: Record<string, string> }[],
  category = 'camisetas',
  root = 'moda-geek'
): PlanProduct => ({
  product_id: `p-${code}`,
  code,
  name,
  category_id: `cat-${category}`,
  category_slug: category,
  root_slug: root,
  skus: skus.map((sku, i) => ({
    sku_id: `s-${code}-${i}`,
    code: `${code}-${i}`,
    attrs: sku.attrs ?? {},
  })),
});

describe('parseName', () => {
  it('takes color and size from the end of a clothing name', () => {
    expect(parseName('Camiseta Naruto Kunai Preto GG', 'moda-geek', 'all')).toEqual({
      base: 'Camiseta Naruto Kunai',
      attrs: { cor: 'Preto', tamanho: 'GG' },
    });
  });

  it('keeps a color that is part of the character name', () => {
    expect(parseName('Camiseta Lanterna Verde', 'moda-geek', 'all').attrs.cor).toBeUndefined();
    expect(parseName('Camiseta Branca de Neve', 'moda-geek', 'all').attrs.cor).toBeUndefined();
  });

  it('puts the accent back on colors from the ERP list', () => {
    expect(parseName('Mochila Disney Stitch Salmão', 'bolsas-e-mochilas', 'color').attrs.cor).toBe(
      'Salmão'
    );
  });

  it('drops the manufacturer code before reading the color', () => {
    expect(
      parseName('Mochila Disney Stitch Azul MC47741SC-Az', 'bolsas-e-mochilas', 'color')
    ).toEqual({
      base: 'Mochila Disney Stitch',
      attrs: { cor: 'Azul' },
      code: 'MC47741SC-Az',
    });
  });

  it('reads the capacity from anywhere only when asked for everything', () => {
    expect(parseName('Caneca Buck 400ML Super Mario', 'casa-e-utensilios', 'all')).toEqual({
      base: 'Caneca Buck Super Mario',
      attrs: { capacidade: '400ml' },
    });
    expect(parseName('Caneca Buck 400ML Super Mario', 'casa-e-utensilios', 'color').base).toBe(
      'Caneca Buck 400ML Super Mario'
    );
    expect(parseName('Copo com Canudo 350 Ml', 'casa-e-utensilios', 'all').attrs.capacidade).toBe(
      '350ml'
    );
  });
});

describe('parseName edge cases', () => {
  it('leaves a two-color name alone and keeps the measure text as written', () => {
    expect(
      parseName('Bandeja de Dados Preto e Cinza', 'jogos-e-cartas', 'color').attrs.cor
    ).toBeUndefined();
    expect(
      parseName('Chaveiro Harry Potter Pomo de Ouro', 'casa-e-utensilios', 'color').attrs.cor
    ).toBeUndefined();
    expect(parseName('Garrafa Disney 500 Ml Rosa', 'casa-e-utensilios', 'color').base).toBe(
      'Garrafa Disney 500 Ml'
    );
  });

  it('reports the manufacturer code it removed from the name', () => {
    expect(parseName('Garrafa Wandinha Verde GF56164WD', 'casa-e-utensilios', 'color')).toEqual({
      base: 'Garrafa Wandinha',
      attrs: { cor: 'Verde' },
      code: 'GF56164WD',
    });
  });
});

describe('takeStyle', () => {
  it('turns Regata and Polo into the Modelo value', () => {
    expect(takeStyle('Camiseta Regata Naruto')).toEqual({
      base: 'Camiseta Naruto',
      modelo: 'Regata',
    });
    expect(takeStyle('Camiseta Naruto')).toEqual({ base: 'Camiseta Naruto' });
  });
});

describe('planFamilies', () => {
  it('merges the same print in different colors into one product with Cor x Tamanho', () => {
    const plan = planFamilies([
      product('CAM-00001', 'Camiseta Batman Preto', [
        { attrs: { tamanho: 'P' } },
        { attrs: { tamanho: 'M' } },
      ]),
      product('CAM-00002', 'Camiseta Batman Azul', [
        { attrs: { tamanho: 'P' } },
        { attrs: { tamanho: 'M' } },
      ]),
    ]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.changes).toHaveLength(1);
    const [change] = plan.changes;
    expect(change).toMatchObject({
      survivorId: 'p-CAM-00001',
      donorIds: ['p-CAM-00002'],
      name: 'Camiseta Batman',
    });
    expect(change?.skus.map((sku) => sku.attrs)).toEqual([
      { cor: 'Preto', tamanho: 'P' },
      { cor: 'Preto', tamanho: 'M' },
      { cor: 'Azul', tamanho: 'P' },
      { cor: 'Azul', tamanho: 'M' },
    ]);
  });

  it('treats Regata/Polo/Basica as the Modelo of the same shirt', () => {
    const plan = planFamilies([
      product('CAM-00010', 'Camiseta Naruto Preto', [{ attrs: { tamanho: 'M' } }]),
      product('CAM-00011', 'Camiseta Regata Naruto Preto', [{ attrs: { tamanho: 'M' } }]),
    ]);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.skus.map((sku) => sku.attrs.modelo)).toEqual(['Básica', 'Regata']);
  });

  it('a product alone only loses the color from its name, and the color becomes an attribute', () => {
    const plan = planFamilies([
      product('CAM-00020', 'Camiseta Megadeth Preto', [{ attrs: { tamanho: 'G' } }]),
    ]);
    expect(plan.changes).toEqual([
      {
        survivorId: 'p-CAM-00020',
        donorIds: [],
        name: 'Camiseta Megadeth',
        skus: [
          {
            sku_id: 's-CAM-00020-0',
            product_id: 'p-CAM-00020',
            attrs: { cor: 'Preto', tamanho: 'G' },
          },
        ],
      },
    ]);
  });

  it('does not merge when two variations would be identical (probable duplicate)', () => {
    const plan = planFamilies([
      product('CAM-00030', 'Camiseta Naruto Preto', [{ attrs: { tamanho: 'M' } }]),
      product('CAM-00031', 'Camiseta Naruto Preto', [{ attrs: { tamanho: 'M' } }]),
    ]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.changes.every((change) => change.donorIds.length === 0)).toBe(true);
  });

  it('does not merge when one member has a color and the other does not', () => {
    const plan = planFamilies([
      product('MOC-00001', 'Mochila Disney Mickey Preta', [{}], 'mochilas', 'bolsas-e-mochilas'),
      product('MOC-00002', 'Mochila Disney Mickey', [{}], 'mochilas', 'bolsas-e-mochilas'),
    ]);
    expect(plan.conflicts).toHaveLength(1);
  });

  it('leaves categories where similar items are different items alone', () => {
    const plan = planFamilies([
      product('MNG-00001', 'Mangá Naruto Vol 01 Azul', [{}], 'mangas', 'hqs-mangas-e-livros'),
      product('MNG-00002', 'Mangá Naruto Vol 01 Preto', [{}], 'mangas', 'hqs-mangas-e-livros'),
    ]);
    expect(plan.changes).toEqual([]);
  });
});

describe('desiredSkuCode', () => {
  const sku = (parts: { attribute: string; suffix: string }[]) => ({
    sku_id: 's',
    code: 'x',
    parts,
  });

  it('is the product code for a product with a single SKU and no variation', () => {
    expect(desiredSkuCode('CAM-00001', sku([]), 1)).toBe('CAM-00001');
  });

  it('adds the suffix of each variation in a fixed order: modelo, cor, tamanho', () => {
    const parts = [
      { attribute: 'tamanho', suffix: 'GG' },
      { attribute: 'cor', suffix: 'PT' },
      { attribute: 'modelo', suffix: 'REG' },
    ];
    expect(desiredSkuCode('CAM-00001', sku(parts), 4)).toBe('CAM-00001-REG-PT-GG');
  });

  it('turns a size range into a code-safe suffix', () => {
    expect(desiredSkuCode('CLC-00001', sku([{ attribute: 'numeracao', suffix: '33/35' }]), 2)).toBe(
      'CLC-00001-33-35'
    );
  });
});
