import { Prisma, prisma } from '@geekstore/db';
import type { SkuSuggestion } from '@geekstore/shared';

import { compactText, matchesWord } from '../../core/db/sql';

const MAX_CANDIDATES = 200;
const MAX_TOKENS = 4;
const MIN_TOKEN_LENGTH = 3;

const tokensOf = (text: string): string[] =>
  text
    .split(/\s+/)
    .map(compactText)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);

/** Distância de edição entre duas palavras (inserir, apagar ou trocar uma letra custa 1). */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

const SHORT_WORD = 4;
const MIN_FUZZY_WORD = 4;
/** Mesma palavra, ou quase: 1 letra de diferença até 4 letras, 2 acima disso ("stich" ~ "stitch"). */
const sameWord = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < MIN_FUZZY_WORD) return false; // "dog" não é "dos"
  return distance(a, b) <= (Math.min(a.length, b.length) <= SHORT_WORD ? 1 : 2);
};

/** Parecença entre dois nomes, 0 a 1: palavras em comum (com tolerância a erro) sobre as palavras de ambos. */
export function nameScore(a: string, b: string): number {
  const left = [...new Set(tokensOf(a))];
  const right = [...new Set(tokensOf(b))];
  if (left.length === 0 || right.length === 0) return 0;
  const shared = left.filter((token) => right.some((other) => sameWord(token, other))).length;
  return shared / (left.length + right.length - shared);
}

type Candidate = { sku_id: string; code: string; product_name: string };

/**
 * SKUs ativos cujo produto cita (ou quase: erro de digitação) alguma das palavras da descrição, os que
 * casam com mais palavras primeiro. Sem a ordenação, uma palavra comum ("pelucia") encheria o limite
 * com produtos que só têm essa palavra.
 */
async function candidatesFor(description: string): Promise<Candidate[]> {
  const tokens = tokensOf(description).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];
  const hits = Prisma.join(
    tokens.map(
      (token) => Prisma.sql`(CASE WHEN ${matchesWord(Prisma.sql`p.name`, token)} THEN 1 ELSE 0 END)`
    ),
    ' + '
  );
  return prisma.$queryRaw<Candidate[]>`
    SELECT sku_id, code, product_name FROM (
      SELECT s.sku_id::text AS sku_id, s.code, p.name AS product_name, (${hits}) AS hits
      FROM sku s
      JOIN product p ON p.product_id = s.product_id
      WHERE s.merged_into_sku_id IS NULL AND p.status <> 'archived'
    ) ranked
    WHERE hits > 0
    ORDER BY hits DESC, code
    LIMIT ${MAX_CANDIDATES}`;
}

/**
 * Sugestões heurísticas para um item de nota sem SKU: os mais parecidos pelo nome. É o ponto de
 * encaixe de um sugeridor melhor (IA): quem chama só precisa de `SkuSuggestion[]`.
 */
export async function suggestSkusByName(
  description: string,
  limit: number
): Promise<SkuSuggestion[]> {
  const candidates = await candidatesFor(description);
  return candidates
    .map((candidate) => ({ ...candidate, score: nameScore(description, candidate.product_name) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, limit)
    .map((candidate) => ({
      ...candidate,
      score: Math.round(candidate.score * 100) / 100,
      source: 'name' as const,
      confidence: null,
      reason: null,
    }));
}
