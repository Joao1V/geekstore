import { describe, expect, it } from 'vitest';

import { type ErpRow, erpRowSchema } from './erp-row';
import { buildPlan } from './plan';

const NOW = new Date('2026-10-02T12:00:00Z');
const PHOTO = 'https://cdn.exemplo.com/a.jpg';

const row = (overrides: Record<string, unknown> = {}): ErpRow =>
  erpRowSchema.parse({
    codigo: 3,
    nome: 'JOGO DE TABULEIRO ROLL CAMERA',
    grupo: 'BRINQUEDOS #',
    subgrupo: 'JOGOS DE TABULEIRO #',
    codigo_barras: '7898572679235',
    preco_venda: 349.99,
    estoque: 2,
    fotos: [PHOTO],
    ...overrides,
  });

const plan = (rows: ErpRow[]) => buildPlan(rows, { now: NOW });
const codes = (result: ReturnType<typeof plan>, legacyCode: string) =>
  result.issues.filter((issue) => issue.legacyCode === legacyCode).map((issue) => issue.code);

describe('buildPlan: item rules', () => {
  it('plans a normal row as an active, published, sellable SKU', () => {
    const [item] = plan([row()]).items;
    expect(item).toMatchObject({
      legacyCode: '3',
      skuCode: 'JTB-3',
      name: 'Jogo de Tabuleiro Roll Camera',
      slug: 'jogo-de-tabuleiro-roll-camera',
      priceCents: 34999,
      stock: 2,
      skuStatus: 'active',
      productStatus: 'active',
      ean: '7898572679235',
      photos: [PHOTO],
    });
  });

  it('keeps the original ERP data for traceability', () => {
    const [item] = plan([row()]).items;
    expect(item?.legacyData).toMatchObject({
      codigo: 3,
      nome: 'JOGO DE TABULEIRO ROLL CAMERA',
      grupo: 'BRINQUEDOS #',
    });
    expect(item?.legacyData).not.toHaveProperty('fotos');
  });

  it('skips excluded groups and items without a price, with the reason', () => {
    const result = plan([
      row({ codigo: 1, grupo: 'USO E CONSUMO #', subgrupo: 'USO E CONSUMO #' }),
      row({ codigo: 2, preco_venda: null }),
      row({ codigo: 4 }),
    ]);
    expect(result.items.map((i) => i.legacyCode)).toEqual(['4']);
    expect(result.skipped.map((s) => [s.legacyCode, s.reason])).toEqual([
      ['1', 'group_excluded'],
      ['2', 'no_price'],
    ]);
  });

  it('zero stock makes the SKU inactive and the product a draft', () => {
    const [item] = plan([row({ estoque: 0 })]).items;
    expect(item).toMatchObject({ stock: 0, skuStatus: 'inactive', productStatus: 'draft' });
  });

  it('turns negative or missing stock into zero and reports it', () => {
    const result = plan([row({ codigo: 5, estoque: -12 }), row({ codigo: 6, estoque: null })]);
    expect(result.items.map((i) => i.stock)).toEqual([0, 0]);
    expect(codes(result, '5')).toContain('stock_negative');
    expect(codes(result, '6')).toContain('stock_missing');
  });

  it('keeps an item without photos as a draft', () => {
    const result = plan([row({ fotos: [] })]);
    expect(result.items[0]?.productStatus).toBe('draft');
    expect(codes(result, '3')).toContain('no_photo');
  });

  it('flags http photos but still imports them', () => {
    const result = plan([
      row({ fotos: ['http://cdn.exemplo.com/a.jpg', 'http://cdn.exemplo.com/a.jpg'] }),
    ]);
    expect(result.items[0]?.photos).toHaveLength(1);
    expect(codes(result, '3')).toContain('photo_not_https');
  });

  it('nulls an invalid EAN and an invalid NCM and reports both', () => {
    const result = plan([row({ codigo_barras: 'SEM GTIN', ncm: '21107' })]);
    expect(result.items[0]).toMatchObject({ ean: null, ncm: null });
    expect(codes(result, '3')).toEqual(expect.arrayContaining(['ean_invalid', 'ncm_invalid']));
  });

  it('flags a valid EAN shared by several items', () => {
    const result = plan([row({ codigo: 7 }), row({ codigo: 8, nome: 'OUTRO NOME' })]);
    expect(result.duplicateEans).toEqual([{ ean: '7898572679235', legacyCodes: ['7', '8'] }]);
    expect(codes(result, '7')).toContain('ean_duplicate');
  });
});

describe('buildPlan: promotions', () => {
  it('applies an undated promotion as a permanent "de/por"', () => {
    const result = plan([row({ preco_venda: 99.9, preco_promocao: 84.9 })]);
    expect(result.items[0]?.promo).toEqual({
      priceCents: 8490,
      compareAtCents: 9990,
      startsAt: null,
      endsAt: null,
    });
    expect(codes(result, '3')).toContain('promo_perpetual');
  });

  it('ignores an expired promotion', () => {
    const result = plan([
      row({
        preco_venda: 11.99,
        preco_promocao: 7.99,
        promocao_inicio: '2025-01-25',
        promocao_fim: '2026-01-25',
      }),
    ]);
    expect(result.items[0]?.promo).toBeNull();
    expect(codes(result, '3')).toContain('promo_expired');
  });

  it('ignores a promotion that is not cheaper than the price', () => {
    const result = plan([row({ preco_venda: 10, preco_promocao: 10 })]);
    expect(result.items[0]?.promo).toBeNull();
    expect(codes(result, '3')).toContain('promo_invalid');
  });
});

describe('buildPlan: slugs', () => {
  it('gives repeated names a unique slug suffixed with the ERP code', () => {
    const result = plan([
      row({ codigo: 10, nome: 'FUNKO POP' }),
      row({ codigo: 11, nome: 'FUNKO POP' }),
    ]);
    expect(result.items.map((i) => i.slug)).toEqual(['funko-pop', 'funko-pop-11']);
    expect(codes(result, '11')).toContain('slug_collision');
  });

  it('never reuses a slug already in the database', () => {
    const result = buildPlan([row({ codigo: 12, nome: 'FUNKO POP' })], {
      now: NOW,
      takenSlugs: new Set(['funko-pop']),
    });
    expect(result.items[0]?.slug).toBe('funko-pop-12');
  });
});

describe('buildPlan: categories (our taxonomy, not the ERP one)', () => {
  const classify = (overrides: Record<string, unknown>) =>
    plan([row({ codigo: 90, ...overrides })]).items[0];

  it('classifies by the product type that starts the ERP name', () => {
    expect(classify({ nome: 'MANGA NARUTO GOLD VOL 03' })?.categoryKey).toBe('mangas');
    expect(classify({ nome: 'CANECA RICK E MORTY 325ML' })?.categoryKey).toBe('canecas');
    expect(classify({ nome: 'PROTETOR DE CARTAS GAMEGENIC 100' })?.categoryKey).toBe(
      'acessorios-de-jogo'
    );
    expect(classify({ nome: 'BONECO FUNKO POP STAR WARS' })).toMatchObject({
      categoryKey: 'funko',
      categoryHow: 'name',
    });
  });

  it('lets the product type beat the brand or theme in the name', () => {
    expect(classify({ nome: 'CAMISETA LEGO NINJAGO PRETA M' })?.categoryKey).toBe('camisetas');
    expect(classify({ nome: 'ESTOJO HOT WHEELS AZUL' })?.categoryKey).toBe(
      'papelaria-e-escritorio'
    );
    expect(classify({ nome: 'MOCHILA FUNKO POP' })?.categoryKey).toBe('mochilas');
    expect(classify({ nome: 'KIT ONE PIECE CARD GAME DECK' })?.categoryKey).toBe(
      'cartas-e-baralhos'
    );
    expect(classify({ nome: 'PORTA RETRATO BEATLES' })?.categoryKey).toBe('decoracao-e-iluminacao');
    expect(classify({ nome: 'JOGO POWER GRID CARD GAME' })?.categoryKey).toBe('jogos-de-tabuleiro');
  });

  it('falls back to the ERP subgroup, then to "A classificar" when there is no clue', () => {
    expect(classify({ nome: 'ITEM SEM TIPO', subgrupo: 'JOGOS DE CARTAS #' })).toMatchObject({
      categoryKey: 'cartas-e-baralhos',
      categoryHow: 'erp',
    });
    expect(classify({ nome: 'ITEM SEM TIPO', subgrupo: 'OUTRA COISA #' })).toMatchObject({
      categoryKey: 'a-classificar',
      categoryHow: 'none',
    });
  });

  it('plans the whole taxonomy tree with the product count of each category', () => {
    const { categories } = plan([
      row({ codigo: 30, nome: 'JOGO DE TABULEIRO A' }),
      row({ codigo: 31, nome: 'JOGO DE TABULEIRO B' }),
      row({ codigo: 32, nome: 'MANGA C' }),
    ]);
    const count = (key: string) => categories.find((c) => c.key === key)?.productCount;
    expect(count('jogos-de-tabuleiro')).toBe(2);
    expect(count('mangas')).toBe(1);
    expect(count('canecas')).toBe(0);
    const root = categories.find((c) => c.key === 'jogos-e-cartas');
    expect(root).toMatchObject({ name: 'Jogos e Cartas', parentKey: null });
    expect(categories.find((c) => c.key === 'jogos-de-tabuleiro')?.parentKey).toBe(
      'jogos-e-cartas'
    );
  });

  it('uses the category prefix for the SKU of a simple product', () => {
    expect(classify({ nome: 'MANGA NARUTO GOLD VOL 03' })?.skuCode).toBe('MNG-90');
    expect(classify({ nome: 'ITEM SEM TIPO', subgrupo: 'OUTRA #' })?.skuCode).toBe('GEN-90');
  });
});
