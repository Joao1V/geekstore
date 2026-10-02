import { suffixFor } from '@geekstore/db';

import { slugify } from './text';

// Palavras que dizem o tipo da peça, não a linha: ficam fora do prefixo do SKU.
const GENERIC_WORDS = new Set([
  'CAMISETA',
  'CAMISA',
  'CMT',
  'INF',
  'INFANTIL',
  'ADULTO',
  'DE',
  'DA',
  'DO',
  'E',
  'COM',
  'PARA',
  'X',
  'GEEK',
]);
const PREFIX_WORDS = 2;
const MAX_PREFIX_WORDS = 4;
const LETTERS = 3;
const FALLBACK_PREFIX = 'VAR';

/** Letras e números maiúsculos, sem acento: "Pokémon" -> "POKEMON". */
const plain = (text: string): string => slugify(text).replace(/-/g, '').toUpperCase();

/** "Camiseta Naruto Kunai" -> "NAR-KUN". Com `wordCount` maior, usa mais palavras do nome. */
export function familyPrefix(baseName: string, wordCount = PREFIX_WORDS): string {
  const words = baseName
    .split(/\s+/)
    .filter((word) => !GENERIC_WORDS.has(word.toUpperCase()))
    .map(plain)
    .filter(Boolean)
    .slice(0, wordCount);
  return words.length > 0 ? words.map((word) => word.slice(0, LETTERS)).join('-') : FALLBACK_PREFIX;
}

export { MAX_PREFIX_WORDS };

/** "Jogos de Tabuleiro" -> "JOG": prefixo do SKU de produto simples. */
export function groupPrefix(groupName: string): string {
  return plain(groupName).slice(0, LETTERS) || FALLBACK_PREFIX;
}

// Ordem dos sufixos no SKU: cor primeiro, depois o que mede (tamanho, numeração, peso...).
const SUFFIX_ORDER = [
  'cor',
  'edicao',
  'tamanho',
  'tamanho_infantil',
  'numeracao',
  'sabor',
  'peso',
  'capacidade',
] as const;

const sizePart = (suffix: string): string => suffix.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

/** "NAR-KUN" + { cor: Preto, tamanho: GG } -> "NAR-KUN-PT-GG" (sufixos do catálogo de atributos). */
export function variantCode(prefix: string, attributes: Record<string, string>): string {
  const parts = SUFFIX_ORDER.flatMap((code) => {
    const label = attributes[code];
    return label ? [sizePart(suffixFor(code, label))] : [];
  });
  return [prefix, ...parts].join('-');
}
