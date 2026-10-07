import { describe, expect, it } from 'vitest';

import { buildWebBatch, parseWebAnswer } from './web-batches';

const franchises = [{ slug: 'harry-potter', name: 'Harry Potter' }];
const items = [
  { id: 'a', name: 'Mochilete Harry Potter Preto MC49222HP', category: 'Mochilas' },
  { id: 'b', name: 'Manga Komi Vol 2', category: 'Mangás' },
  { id: 'c', name: 'Caneca Lisa 300ML', category: 'Canecas' },
];

describe('buildWebBatch', () => {
  it('lists the franchises and numbers the products', () => {
    const text = buildWebBatch(items, franchises, 7);
    expect(text).toContain('# Lote 007');
    expect(text).toContain('harry-potter (Harry Potter)');
    expect(text).toContain('2 | Mangás | Manga Komi Vol 2');
  });
});

describe('parseWebAnswer', () => {
  it('reads the lines, with or without the code fence, and keeps what is valid', () => {
    const answer = [
      '```',
      '1 | Mochilete Harry Potter Preto | harry-potter | alta | MC49222HP',
      '2 | Manga Komi Vol. 2 | +Komi | média | -',
      '3 | Caneca Lisa 300ml | - | alta | -',
      '```',
    ].join('\n');
    const { suggestions, unreadable } = parseWebAnswer(answer, items, franchises);
    expect(unreadable).toBe(0);
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toMatchObject({
      id: 'a',
      franchise: { kind: 'existing', slug: 'harry-potter' },
      removed_codes: ['MC49222HP'],
    });
    expect(suggestions[1]).toMatchObject({
      id: 'b',
      franchise: { kind: 'new', name: 'Komi' },
      confidence: 'medium',
    });
  });

  it('counts broken lines and drops names that invent a number', () => {
    const answer = [
      'texto solto',
      '9 | Fora da lista | - | alta | -',
      '2 | Manga Komi Vol. 3 | - | alta | -',
      '3 | Caneca Lisa 300ml | - | talvez | -',
      '1 | Mochilete Harry Potter Preto | - | alta | -',
    ].join('\n');
    const { suggestions, unreadable } = parseWebAnswer(answer, items, franchises);
    expect(unreadable).toBe(3);
    expect(suggestions.map((s) => s.id)).toEqual(['a']);
  });
});
