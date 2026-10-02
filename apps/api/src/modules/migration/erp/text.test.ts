import { describe, expect, it } from 'vitest';

import { cleanDescription, cleanGroupName, normalizeName, slugify } from './text';

describe('normalizeName', () => {
  it('turns ALL CAPS into title case and keeps punctuation', () => {
    expect(normalizeName('JOGO DE TABULEIRO ROLL CAMERA')).toBe('Jogo de Tabuleiro Roll Camera');
    expect(normalizeName('FUNKO POP! SPIDER-MAN')).toBe('Funko Pop! Spider-Man');
  });

  it('keeps acronyms, words with digits and single letters (sizes) in upper case', () => {
    expect(normalizeName('LEGO ONE PIECE GOING MERRY 75639')).toBe(
      'LEGO One Piece Going Merry 75639'
    );
    expect(normalizeName('CHINELO COBRA KAI G 39/41')).toBe('Chinelo Cobra Kai G 39/41');
    expect(normalizeName('CAMISETA HARRY POTTER PS5 3D')).toBe('Camiseta Harry Potter PS5 3D');
    expect(normalizeName('STAR WARS EPISODIO III')).toBe('Star Wars Episodio III');
    expect(normalizeName('MINIATURA HW MONSTER TRUCKS')).toBe('Miniatura HW Monster Trucks');
  });

  it('lower-cases articles and prepositions except at the start', () => {
    expect(normalizeName('A CASA DO SOL E AS ESTRELAS')).toBe('A Casa do Sol e as Estrelas');
  });

  it('collapses whitespace', () => {
    expect(normalizeName('  FUNKO   POP  ')).toBe('Funko Pop');
  });
});

describe('cleanGroupName', () => {
  it('drops the trailing # the ERP appends to groups', () => {
    expect(cleanGroupName('JOGOS DE TABULEIRO #')).toBe('Jogos de Tabuleiro');
    expect(cleanGroupName('COLECIONÁVEL #')).toBe('Colecionável');
    expect(cleanGroupName('ACESSÓRIOS/EXPANÇÕES #')).toBe('Acessórios/Expanções');
  });
});

describe('slugify', () => {
  it('removes accents and symbols', () => {
    expect(slugify('Pokémon: Coleção Especial (2ª Edição)!')).toBe(
      'pokemon-colecao-especial-2a-edicao'
    );
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(199)} b`);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('cleanDescription', () => {
  it('strips tags and decodes entities', () => {
    expect(cleanDescription('<p>Jogo &amp; diversão</p><br/>Para <b>todos</b>')).toBe(
      'Jogo & diversão\n\nPara todos'
    );
  });

  it('returns null for empty input', () => {
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription('  <br> ')).toBeNull();
  });
});
