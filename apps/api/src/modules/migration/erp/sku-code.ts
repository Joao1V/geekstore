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
const LETTERS = 3;
const FALLBACK_PREFIX = 'VAR';

/** Letras e números maiúsculos, sem acento: "Pokémon" -> "POKEMON". */
const plain = (text: string): string => slugify(text).replace(/-/g, '').toUpperCase();

/** "Camiseta Naruto Kunai" -> "NAR-KUN". */
export function familyPrefix(baseName: string): string {
  const words = baseName
    .split(/\s+/)
    .filter((word) => !GENERIC_WORDS.has(word.toUpperCase()))
    .map(plain)
    .filter(Boolean)
    .slice(0, PREFIX_WORDS);
  return words.length > 0 ? words.map((word) => word.slice(0, LETTERS)).join('-') : FALLBACK_PREFIX;
}

/** "Jogos de Tabuleiro" -> "JOG": prefixo do SKU de produto simples. */
export function groupPrefix(groupName: string): string {
  return plain(groupName).slice(0, LETTERS) || FALLBACK_PREFIX;
}

/** Códigos de cor com 3 letras, sem ambiguidade (VERDE e VERMELHO não podem ser os dois "VER"). */
export const COLOR_CODES: Record<string, string> = {
  'AZUL MARINHO': 'AZM',
  'OFF WHITE': 'OFW',
  PRETO: 'PRE',
  PRETA: 'PRE',
  BRANCO: 'BRA',
  BRANCA: 'BRA',
  AZUL: 'AZU',
  VERMELHO: 'VML',
  VERMELHA: 'VML',
  LARANJA: 'LAR',
  VINHO: 'VIN',
  VERDE: 'VRD',
  AMARELO: 'AMA',
  AMARELA: 'AMA',
  ROSA: 'ROS',
  CINZA: 'CIN',
  ROXO: 'ROX',
  ROXA: 'ROX',
  MARROM: 'MAR',
  CARBONO: 'CAR',
  BEGE: 'BEG',
  DOURADO: 'DOU',
  PRATA: 'PRA',
  MARINHO: 'MRN',
  LILAS: 'LIL',
};

const sizePart = (size: string): string => size.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

/** "NAR-KUN" + Preto + GG -> "NAR-KUN-PRE-GG". */
export function variantCode(
  prefix: string,
  attributes: { cor?: string; tamanho?: string; numeracao?: string }
): string {
  const color = attributes.cor ? COLOR_CODES[attributes.cor.toUpperCase()] : undefined;
  return [
    prefix,
    color,
    attributes.tamanho ? sizePart(attributes.tamanho) : undefined,
    attributes.numeracao ? sizePart(attributes.numeracao) : undefined,
  ]
    .filter(Boolean)
    .join('-');
}
