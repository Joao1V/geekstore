import { describe, expect, it, vi } from 'vitest';

import { buildPrompt, cleanupBatches, introducesNewNumber, parseCleanup } from './name-cleanup';

const franchises = [
  { slug: 'disney', name: 'Disney' },
  { slug: 'naruto', name: 'Naruto' },
];
const items = [
  {
    id: 'a1',
    name: 'Mochilete com Carrinho Mundo Mágico Harry Potter Preto MC49222HP',
    category: 'Mochilas',
  },
  { id: 'a2', name: 'Manga Tokyo Ghoul', category: 'Mangás' },
  { id: 'a3', name: 'Caneca Lisa', category: 'Canecas' },
];

describe('buildPrompt', () => {
  it('lists the franchises and the products with their ids', () => {
    const { user, system } = buildPrompt(items, franchises);
    expect(user).toContain('disney (Disney), naruto (Naruto)');
    expect(user).toContain('a2 | Mangás | Manga Tokyo Ghoul');
    expect(system).toContain('NÃO invente');
  });
});

describe('parseCleanup', () => {
  const answer = JSON.stringify([
    {
      id: 'a1',
      name: 'Mochilete com Carrinho Mundo Mágico Harry Potter Preto',
      franchise: { new: 'Harry Potter' },
      confidence: 'high',
    },
    {
      id: 'a2',
      name: 'Manga Tokyo Ghoul',
      franchise: { new: 'Tokyo Ghoul' },
      confidence: 'medium',
    },
    { id: 'a3', name: 'Caneca Lisa', franchise: null, confidence: 'high' },
  ]);

  it('reads the suggestions, with text around the JSON too', () => {
    const rows = parseCleanup(`Aqui está:\n${answer}\nPronto.`, items, franchises);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: 'a1', franchise: { kind: 'new', name: 'Harry Potter' } });
    expect(rows[2]?.franchise).toBeNull();
  });

  it('turns an invented franchise slug into "no franchise" and keeps real ones', () => {
    const text = JSON.stringify([
      { id: 'a1', name: 'X', franchise: { slug: 'inventada' }, confidence: 'high' },
      { id: 'a2', name: 'Y', franchise: { slug: 'naruto' }, confidence: 'low' },
    ]);
    const rows = parseCleanup(text, items, franchises);
    expect(rows[0]?.franchise).toBeNull();
    expect(rows[1]?.franchise).toEqual({ kind: 'existing', slug: 'naruto' });
  });

  it('ignores ids that were not asked, repeated ids and answers out of the format', () => {
    const text = JSON.stringify([
      { id: 'zzz', name: 'Fora', franchise: null, confidence: 'high' },
      { id: 'a1', name: 'Um', franchise: null, confidence: 'high' },
      { id: 'a1', name: 'Dois', franchise: null, confidence: 'high' },
    ]);
    expect(parseCleanup(text, items, franchises).map((row) => row.name)).toEqual(['Um']);
    expect(parseCleanup('não sei', items, franchises)).toEqual([]);
    expect(parseCleanup('[{"id": 1}]', items, franchises)).toEqual([]);
    expect(parseCleanup('[ quebrado', items, franchises)).toEqual([]);
  });
});

describe('cleanupBatches', () => {
  it('asks in batches of 20, counts what came back wrong and survives a failing batch', async () => {
    const many = Array.from({ length: 45 }, (_, index) => ({
      id: `p${index}`,
      name: `Produto ${index}`,
      category: 'X',
    }));
    const complete = vi
      .fn()
      .mockImplementationOnce(async ({ user }: { user: string }) =>
        JSON.stringify(
          user
            .split('\n')
            .filter((line) => line.startsWith('p'))
            .map((line) => ({
              id: line.split(' | ')[0],
              name: 'Limpo',
              franchise: null,
              confidence: 'high',
            }))
        )
      )
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce('texto sem json');
    const result = await cleanupBatches(many, franchises, complete);
    expect(complete).toHaveBeenCalledTimes(3);
    expect(result.suggestions).toHaveLength(20);
    expect(result.skipped).toBe(25);
  });
});

describe('introducesNewNumber', () => {
  it('lets numbers go away (manufacturer codes) but never appear or change', () => {
    expect(introducesNewNumber('Mochilete Preto MC49222HP', 'Mochilete Preto')).toBe(false);
    expect(introducesNewNumber('Manga Naruto Vol 02', 'Manga Naruto Vol. 02')).toBe(false);
    expect(
      introducesNewNumber('Hot Wheels 2/5 Alpha Pursuit 18', 'Hot Wheels Alpha Pursuit 18/250')
    ).toBe(true);
    expect(introducesNewNumber('LEGO Art Love 791 Peças #31214', 'LEGO Art Love 800 Peças')).toBe(
      true
    );
  });

  it('makes parseCleanup drop a suggestion that invents a number', () => {
    const text = JSON.stringify([
      { id: 'a2', name: 'Manga Tokyo Ghoul Vol. 9', franchise: null, confidence: 'high' },
      {
        id: 'a1',
        name: 'Mochilete com Carrinho Mundo Mágico Harry Potter Preto',
        franchise: null,
        confidence: 'high',
      },
    ]);
    expect(parseCleanup(text, items, franchises).map((row) => row.id)).toEqual(['a1']);
  });
});
