import { describe, expect, it } from 'vitest';

import { nameScore } from './receipt-matching';

describe('nameScore', () => {
  it('is 1 for the same words and 0 for nothing in common', () => {
    expect(nameScore('Caneca Dog 300ML', 'caneca dog 300ml')).toBe(1);
    expect(nameScore('Caneca Dog', 'Boneco Hulk')).toBe(0);
  });

  it('forgives a typo in a word of 4 or more letters', () => {
    expect(nameScore('PELUCIA STICH', 'Pelúcia Disney Stitch')).toBeGreaterThan(0.5);
    expect(nameScore('harry poter', 'Harry Potter')).toBe(1);
  });

  it('does not match short different words', () => {
    expect(nameScore('Caneca dog', 'Caneca dos')).toBeLessThan(1);
  });

  it('gives a name with more words in common a higher score', () => {
    const wanted = 'Caneca Melhor Pai Dog 300ML';
    expect(nameScore(wanted, 'Caneca Melhor Pai de Dog 300ML')).toBeGreaterThan(
      nameScore(wanted, 'Caneca Melhor Pai de Gato 300ML')
    );
  });
});
