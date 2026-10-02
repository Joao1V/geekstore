import { describe, expect, it } from 'vitest';

import {
  assertValidPlacement,
  type CategoryNode,
  depthOf,
  descendantIds,
  subtreeHeight,
} from './category-tree';

// a (raiz) > b > c ; d (raiz) ; e (raiz) > f
const nodes: CategoryNode[] = [
  { category_id: 'a', parent_id: null },
  { category_id: 'b', parent_id: 'a' },
  { category_id: 'c', parent_id: 'b' },
  { category_id: 'd', parent_id: null },
  { category_id: 'e', parent_id: null },
  { category_id: 'f', parent_id: 'e' },
];
const parentById = new Map(nodes.map((n) => [n.category_id, n.parent_id]));

describe('category tree depth', () => {
  it('computes depth and subtree height', () => {
    expect(depthOf('a', parentById)).toBe(1);
    expect(depthOf('c', parentById)).toBe(3);
    expect(subtreeHeight('a', nodes)).toBe(3);
    expect(subtreeHeight('c', nodes)).toBe(1);
  });

  it('accepts a root and placements within 3 levels', () => {
    expect(() => assertValidPlacement(nodes, null, null)).not.toThrow();
    expect(() => assertValidPlacement(nodes, null, 'b')).not.toThrow(); // novo nó no nível 3
    expect(() => assertValidPlacement(nodes, 'f', 'd')).not.toThrow();
  });

  it('rejects a 4th level for new categories', () => {
    expect(() => assertValidPlacement(nodes, null, 'c')).toThrow(/3 níveis/);
  });

  it('rejects moving a subtree that would exceed 3 levels', () => {
    // e > f seria movida sob b: b(2) + altura de e(2) = 4
    expect(() => assertValidPlacement(nodes, 'e', 'b')).toThrow(/3 níveis/);
    // a (altura 3) sob d: 1 + 3 = 4
    expect(() => assertValidPlacement(nodes, 'a', 'd')).toThrow(/3 níveis/);
  });

  it('rejects self-parent, cycles and unknown parents', () => {
    expect(() => assertValidPlacement(nodes, 'a', 'a')).toThrow();
    expect(() => assertValidPlacement(nodes, 'a', 'c')).toThrow(/dentro de si mesma/);
    expect(() => assertValidPlacement(nodes, null, 'zzz')).toThrow(/não encontrada/);
  });
});

describe('descendantIds', () => {
  const nodes = [
    { category_id: 'a', parent_id: null },
    { category_id: 'b', parent_id: 'a' },
    { category_id: 'c', parent_id: 'b' },
    { category_id: 'd', parent_id: null },
  ];

  it('returns the category and every category below it', () => {
    expect(descendantIds(nodes, 'a').sort()).toEqual(['a', 'b', 'c']);
    expect(descendantIds(nodes, 'b').sort()).toEqual(['b', 'c']);
  });

  it('returns only itself for a leaf and ignores other branches', () => {
    expect(descendantIds(nodes, 'c')).toEqual(['c']);
    expect(descendantIds(nodes, 'd')).toEqual(['d']);
  });
});
