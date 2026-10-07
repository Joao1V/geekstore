import { describe, expect, it } from 'vitest';

import { distinguishedByAttributes, planConsolidation, type Row } from './consolidate';

const row = (over: Partial<Row> & { product_id: string; sku_id: string }): Row => ({
  category_id: 'c1',
  category: 'Camisetas',
  key: 'camisetanaruto',
  name: 'Camiseta Naruto',
  sku_code: over.sku_id.toUpperCase(),
  legacy_code: null,
  ean: null,
  price_cents: 5990,
  photos: 0,
  attrs: {},
  sku_count: 1,
  ...over,
});

describe('planConsolidation', () => {
  it('merges the same EAN as a duplicate, keeping the one with photos', () => {
    const plan = planConsolidation([
      row({ product_id: 'a', sku_id: 'a1', ean: '789', photos: 0 }),
      row({ product_id: 'b', sku_id: 'b1', ean: '789', photos: 2 }),
    ]);
    expect(plan.sameEan).toHaveLength(1);
    expect(plan.sameEan[0]?.map((r) => r.sku_id)).toEqual(['b1', 'a1']);
    expect(plan.variants).toHaveLength(0);
  });

  it('turns loose items with the same name and different EAN into variations', () => {
    const plan = planConsolidation([
      row({ product_id: 'a', sku_id: 'a1', ean: '1' }),
      row({ product_id: 'b', sku_id: 'b1', ean: '2' }),
    ]);
    expect(plan.variants).toHaveLength(1);
    expect(plan.review).toHaveLength(0);
  });

  it('keeps sizes apart when they already tell the items apart', () => {
    const plan = planConsolidation([
      row({ product_id: 'a', sku_id: 'a1', ean: '1', attrs: { tamanho: 'p' } }),
      row({ product_id: 'b', sku_id: 'b1', ean: '2', attrs: { tamanho: 'm' } }),
    ]);
    expect(plan.variants).toHaveLength(1);
    expect(distinguishedByAttributes(plan.variants[0]?.flat() ?? [])).toBe(true);
  });

  it('sends a size family plus a loose item without size to review', () => {
    const plan = planConsolidation([
      row({ product_id: 'a', sku_id: 'a1', ean: '1', attrs: { tamanho: 'p' }, sku_count: 2 }),
      row({ product_id: 'a', sku_id: 'a2', ean: '2', attrs: { tamanho: 'm' }, sku_count: 2 }),
      row({ product_id: 'b', sku_id: 'b1', ean: '3' }),
    ]);
    expect(plan.review).toHaveLength(1);
    expect(plan.variants).toHaveLength(0);
  });

  it('never groups different categories', () => {
    const plan = planConsolidation([
      row({ product_id: 'a', sku_id: 'a1', ean: '1' }),
      row({ product_id: 'b', sku_id: 'b1', ean: '2', category_id: 'c2' }),
    ]);
    expect(plan.variants).toHaveLength(0);
    expect(plan.sameEan).toHaveLength(0);
  });
});
