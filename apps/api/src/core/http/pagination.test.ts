import { describe, expect, it } from 'vitest';

import { buildMeta, parseSort, skipTake } from './pagination';

const allowed = ['name', 'created_at'] as const;
const fallback = { field: 'created_at', direction: 'desc' } as const;

describe('parseSort', () => {
  it('uses the fallback without sort', () => {
    expect(parseSort(undefined, allowed, fallback)).toEqual(fallback);
  });

  it('parses field and direction, defaulting to asc', () => {
    expect(parseSort('name:desc', allowed, fallback)).toEqual({ field: 'name', direction: 'desc' });
    expect(parseSort('name', allowed, fallback)).toEqual({ field: 'name', direction: 'asc' });
  });

  it('rejects fields outside the allow-list and malformed values', () => {
    expect(() => parseSort('password_hash:asc', allowed, fallback)).toThrow();
    expect(() => parseSort('name:up', allowed, fallback)).toThrow();
    expect(() => parseSort('name:asc:x', allowed, fallback)).toThrow();
  });
});

describe('pagination helpers', () => {
  it('computes skip/take and meta', () => {
    expect(skipTake(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(buildMeta(1, 20, 41)).toEqual({ page: 1, page_size: 20, total: 41, total_pages: 3 });
    expect(buildMeta(1, 20, 0).total_pages).toBe(0);
  });
});
