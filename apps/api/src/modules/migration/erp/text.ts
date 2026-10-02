// Normalização de texto vindo do ERP: nomes em CAIXA ALTA, grupos terminados em "#", HTML solto.

const LOWERCASE_WORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'e',
  'ou',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'por',
  'com',
  'sem',
  'ao',
  'aos',
  'um',
  'uma',
]);

// Siglas e marcas que ficam em maiúsculas. Palavras com dígitos (PS5, 3D, 75639) já ficam como estão.
const UPPERCASE_WORDS = new Set([
  'LEGO',
  'HQ',
  'HQS',
  'DC',
  'TCG',
  'RPG',
  'UNO',
  'USB',
  'LED',
  'PVC',
  'MDF',
  'DVD',
  'CD',
  'TV',
  'HW',
  'PT',
  'NBA',
  'NFL',
  'UFC',
  'FIFA',
  'BTS',
  'GT',
  'SUV',
  'PP',
  'GG',
  'XG',
  'XGG',
  'EXG',
  'II',
  'III',
  'IV',
  'VI',
  'VII',
  'VIII',
  'IX',
  'XI',
  'XII',
]);

const WORD_PATTERN = /[\p{L}\p{N}']+/gu;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeWord(word: string, isFirst: boolean): string {
  const upper = word.toUpperCase();
  if (UPPERCASE_WORDS.has(upper) || /\d/.test(word) || word.length === 1) {
    return word.length === 1 && LOWERCASE_WORDS.has(word.toLowerCase()) && !isFirst
      ? word.toLowerCase()
      : upper;
  }
  if (!isFirst && LOWERCASE_WORDS.has(word.toLowerCase())) return word.toLowerCase();
  return capitalize(word);
}

/** "FUNKO POP! DRAGON BALL Z - GOKU" -> "Funko Pop! Dragon Ball Z - Goku". Pontuação é preservada. */
export function normalizeName(name: string): string {
  let index = 0;
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(WORD_PATTERN, (word) => normalizeWord(word, index++ === 0));
}

/** "JOGOS DE TABULEIRO #" -> "Jogos de Tabuleiro". */
export function cleanGroupName(name: string): string {
  return normalizeName(name.replace(/#/g, ' '));
}

const MAX_SLUG_LENGTH = 200;

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};
const MAX_DESCRIPTION_LENGTH = 20_000;

/** Texto puro: tira tags, decodifica entidades básicas e junta espaços. Vazio vira `null`. */
export function cleanDescription(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text ? text.slice(0, MAX_DESCRIPTION_LENGTH) : null;
}
