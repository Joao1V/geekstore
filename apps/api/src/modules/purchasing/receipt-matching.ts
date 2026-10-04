import { Prisma, prisma } from '@geekstore/db';
import type { SkuSuggestion } from '@geekstore/shared';

import { compactText } from '../../core/db/sql';

const MAX_CANDIDATES = 200;
const MAX_TOKENS = 4;
const MIN_TOKEN_LENGTH = 3;

const tokensOf = (text: string): string[] =>
  text
    .split(/\s+/)
    .map(compactText)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);

/** Parecença entre dois nomes, 0 a 1: palavras em comum sobre as palavras de ambos (Jaccard). */
export function nameScore(a: string, b: string): number {
  const left = new Set(tokensOf(a));
  const right = new Set(tokensOf(b));
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / (left.size + right.size - shared);
}

type Candidate = { sku_id: string; code: string; product_name: string };

/** SKUs ativos cujo produto cita alguma das palavras da descrição (sem acento, sem diferença de caixa). */
async function candidatesFor(description: string): Promise<Candidate[]> {
  const tokens = tokensOf(description).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];
  const anyToken = Prisma.join(
    tokens.map(
      (token) =>
        Prisma.sql`regexp_replace(lower(unaccent(p.name)), '[^a-z0-9]+', '', 'g') LIKE ${`%${token}%`}`
    ),
    ' OR '
  );
  return prisma.$queryRaw<Candidate[]>`
    SELECT s.sku_id::text AS sku_id, s.code, p.name AS product_name
    FROM sku s
    JOIN product p ON p.product_id = s.product_id
    WHERE s.merged_into_sku_id IS NULL AND p.status <> 'archived' AND (${anyToken})
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
    .map((candidate) => ({ ...candidate, score: Math.round(candidate.score * 100) / 100 }));
}
