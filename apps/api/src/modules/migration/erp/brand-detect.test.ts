import { describe, expect, it } from 'vitest';

import { detectBrand } from './brand-detect';

describe('detectBrand', () => {
  it('finds a brand cited in the item name, ignoring case and accents', () => {
    expect(detectBrand('Funko Pop! Pokémon Pikachu')).toBe('Funko');
    expect(detectBrand('LEGO Pokemon Arcanine #0059')).toBe('LEGO');
    expect(detectBrand('Booster Konami Yu-Gi-Oh!')).toBe('Konami');
    expect(detectBrand('JOGO PAPERGAMES COOPERATIVO')).toBe('Paper Games');
    expect(detectBrand('Jogo Galápagos Catan')).toBe('Galápagos');
  });

  it('does not guess from ordinary words or partial matches', () => {
    expect(detectBrand('Manga Oshi no Ko Minha Estrela Preferida Vol 16')).toBeNull();
    expect(detectBrand('Camiseta Legolas Verde')).toBeNull();
    expect(detectBrand('Pelúcia Grow Up')).toBeNull();
    expect(detectBrand('Caneca Rick e Morty')).toBeNull();
  });
});
