import { describe, expect, it } from 'vitest';

import { compareResults, mergeResults, summarize } from './compare-models';
import type { CleanupSuggestion } from './name-cleanup';

const row = (
  id: string,
  name: string,
  franchise: CleanupSuggestion['franchise'] = null
): CleanupSuggestion => ({
  id,
  name,
  franchise,
  confidence: 'high',
  removed_codes: [],
});
const originals = new Map([
  ['1', 'Mochilete HP MC49222HP'],
  ['2', 'Manga Komi Vol 2'],
  ['3', 'Caneca Lisa'],
  ['4', 'Boneco X'],
]);

describe('compareResults', () => {
  const a = [
    row('1', 'Mochilete HP', { kind: 'existing', slug: 'harry-potter' }),
    row('2', 'Manga Komi Vol. 2'),
    row('3', 'Caneca Lisa'),
  ];
  const b = [
    row('1', 'mochilete hp', { kind: 'existing', slug: 'harry-potter' }),
    row('2', 'Mangá Komi Volume 2'),
    row('3', 'Caneca Lisa', { kind: 'new', name: 'Lisa' }),
    row('4', 'Boneco X'),
  ];
  const rows = compareResults(originals, a, b);

  it('treats case, accents and punctuation as the same name', () => {
    expect(rows.find((r) => r.id === '1')?.differs).toEqual([]);
  });

  it('flags name and franchise differences and who answered alone', () => {
    expect(rows.find((r) => r.id === '2')?.differs).toEqual(['name']);
    expect(rows.find((r) => r.id === '3')?.differs).toEqual(['franchise']);
    expect(rows.find((r) => r.id === '4')?.differs).toEqual(['only_b']);
  });

  it('summarizes the agreement', () => {
    expect(summarize(rows)).toMatchObject({
      total: 4,
      both: 3,
      agree: 1,
      nameDiffers: 1,
      franchiseDiffers: 1,
      onlyB: 1,
    });
  });

  it('merges by preference, with per-product overrides, keeping what only one answered', () => {
    expect(mergeResults(rows, 'a').map((r) => r.name)).toEqual([
      'Mochilete HP',
      'Manga Komi Vol. 2',
      'Caneca Lisa',
      'Boneco X',
    ]);
    const mixed = mergeResults(rows, 'a', { '2': 'b' });
    expect(mixed.find((r) => r.id === '2')?.name).toBe('Mangá Komi Volume 2');
  });
});
