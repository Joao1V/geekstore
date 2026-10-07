import { describe, expect, it } from 'vitest';

import { planCleanup } from './apply-cleanup';
import type { CleanupSuggestion } from './name-cleanup';

const products = [
  { product_id: 'p1', name: 'Mochilete Preto MC49222HP', slug: 'mochilete-preto-mc49222hp' },
  { product_id: 'p2', name: 'Manga Komi Vol 1', slug: 'manga-komi-vol-1' },
  { product_id: 'p3', name: 'Manga Komi Vol 2', slug: 'manga-komi-vol-2' },
  { product_id: 'p4', name: 'Manga Komi Vol 3', slug: 'manga-komi-vol-3' },
  { product_id: 'p5', name: 'Caneca Lisa', slug: 'caneca-lisa' },
  { product_id: 'p6', name: 'Coisa Solta Xyz', slug: 'coisa-solta-xyz' },
];
const row = (
  over: Partial<CleanupSuggestion> & { id: string; name: string }
): CleanupSuggestion => ({
  franchise: null,
  confidence: 'high',
  removed_codes: [],
  ...over,
});

describe('planCleanup', () => {
  const existing = new Set(['harry-potter']);

  it('renames with a fresh slug, keeps the manufacturer code and links an existing franchise', () => {
    const plan = planCleanup(
      [
        row({
          id: 'p1',
          name: 'Mochilete Preto',
          franchise: { kind: 'existing', slug: 'harry-potter' },
          removed_codes: ['MC49222HP'],
        }),
      ],
      products,
      existing
    );
    expect(plan.renames).toEqual([
      {
        product_id: 'p1',
        old_name: 'Mochilete Preto MC49222HP',
        name: 'Mochilete Preto',
        slug: 'mochilete-preto',
      },
    ]);
    expect(plan.franchiseLinks).toEqual([{ product_id: 'p1', slug: 'harry-potter' }]);
    expect(plan.codes.get('p1')).toEqual(['MC49222HP']);
  });

  it('skips low confidence and leaves an unchanged name alone', () => {
    const plan = planCleanup(
      [
        row({ id: 'p5', name: 'Caneca Lisa' }),
        row({ id: 'p6', name: 'Coisa Solta', confidence: 'low' }),
      ],
      products,
      existing
    );
    expect(plan.renames).toEqual([]);
    expect(plan.skipped.low_confidence).toBe(1);
  });

  it('creates a new franchise only when at least 3 products point to it', () => {
    const komi = (id: string) =>
      row({ id, name: 'Manga Komi', franchise: { kind: 'new', name: 'Komi' } });
    const few = planCleanup([komi('p2'), komi('p3')], products, existing);
    expect(few.newFranchises.size).toBe(0);
    expect(few.franchiseLinks).toEqual([]);
    const enough = planCleanup([komi('p2'), komi('p3'), komi('p4')], products, existing);
    expect([...enough.newFranchises.keys()]).toEqual(['komi']);
    expect(enough.franchiseLinks).toHaveLength(3);
  });

  it('never repeats a slug already taken', () => {
    const plan = planCleanup(
      [row({ id: 'p2', name: 'Manga Komi' }), row({ id: 'p3', name: 'Manga Komi' })],
      products,
      existing
    );
    expect(plan.renames.map((r) => r.slug)).toEqual(['manga-komi', 'manga-komi-2']);
  });

  it('ignores suggestions for products that no longer exist', () => {
    const plan = planCleanup([row({ id: 'zzz', name: 'X' })], products, existing);
    expect(plan.renames).toEqual([]);
    expect(plan.skipped.unknown_product).toBe(1);
  });
});
