import { z } from 'zod';

import { dataResponse, paginatedResponse, paginationQuerySchema } from './common';

// Duplicados: produtos simples (1 SKU) que têm o mesmo nome depois de ignorar acento, pontuação e o
// "#código" no fim. Atenção: o MESMO EAN sozinho não prova nada, porque o ERP reaproveita um código
// de barras para séries inteiras (73 Hot Wheels diferentes com o mesmo EAN).

/**
 * - `certain`: mesmo nome + mesmo EAN + mesmo preço (o mesmo produto cadastrado duas vezes).
 * - `likely`: mesmo nome e (mesmo EAN com preço diferente, ou mesmo preço com EAN diferente/vazio).
 * - `review`: mesmo nome, mas EAN e preço diferentes (pode ser variação ou produto parecido).
 */
export const duplicateLevelSchema = z.enum(['certain', 'likely', 'review']);
export type DuplicateLevel = z.infer<typeof duplicateLevelSchema>;

export const duplicateItemSchema = z.object({
  product_id: z.string().uuid(),
  sku_id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  legacy_code: z.string().nullable(),
  ean: z.string().nullable(),
  price_cents: z.number().int().nullable(),
  /** Saldo físico somado (locais vendáveis). */
  stock: z.number().int(),
  photos: z.number().int(),
  thumbnail_url: z.string().nullable(),
});
export type DuplicateItem = z.infer<typeof duplicateItemSchema>;

export const duplicateGroupSchema = z.object({
  /** Identifica o grupo (hash dos SKUs); muda se entrar um item novo. */
  key: z.string(),
  level: duplicateLevelSchema,
  /** Por que são parecidos, em palavras ("mesmo EAN", "mesmo preço"). */
  reasons: z.array(z.string()),
  items: z.array(duplicateItemSchema),
  /** O item que a tela sugere manter (mais fotos, depois o código mais antigo). */
  suggested_survivor_sku_id: z.string().uuid(),
  /** Estoque total do grupo: o que sobra no item mantido depois de mesclar. */
  total_stock: z.number().int(),
});
export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;

export const duplicateListQuerySchema = paginationQuerySchema.omit({ sort: true }).extend({
  level: duplicateLevelSchema.optional(),
});
export type DuplicateListQuery = z.infer<typeof duplicateListQuerySchema>;
export const duplicateListResponseSchema = paginatedResponse(duplicateGroupSchema);

export const duplicateSummarySchema = z.object({
  certain: z.number().int(),
  likely: z.number().int(),
  review: z.number().int(),
});
export type DuplicateSummary = z.infer<typeof duplicateSummarySchema>;
export const duplicateSummaryResponseSchema = dataResponse(duplicateSummarySchema);

export const duplicateMergeBodySchema = z.object({
  survivor_sku_id: z.string().uuid(),
  duplicate_sku_ids: z.array(z.string().uuid()).min(1).max(20),
});
export type DuplicateMergeBody = z.infer<typeof duplicateMergeBodySchema>;

export const duplicateMergeResultSchema = z.object({
  skus_archived: z.number().int(),
  units_moved: z.number().int(),
});
export type DuplicateMergeResult = z.infer<typeof duplicateMergeResultSchema>;
export const duplicateMergeResponseSchema = dataResponse(duplicateMergeResultSchema);

export const duplicateMergeCertainBodySchema = z.object({
  /** `true` só calcula o que seria feito, sem alterar nada. */
  dry_run: z.boolean().default(true),
});
export type DuplicateMergeCertainBody = z.infer<typeof duplicateMergeCertainBodySchema>;

export const duplicateMergeCertainResultSchema = duplicateMergeResultSchema.extend({
  groups: z.number().int(),
  /** Grupos que não puderam ser mesclados (ex.: item com reserva ativa), com o motivo. */
  skipped: z.array(z.object({ key: z.string(), reason: z.string() })),
  dry_run: z.boolean(),
});
export type DuplicateMergeCertainResult = z.infer<typeof duplicateMergeCertainResultSchema>;
export const duplicateMergeCertainResponseSchema = dataResponse(duplicateMergeCertainResultSchema);

export const duplicateDismissBodySchema = z.object({
  sku_ids: z.array(z.string().uuid()).min(2).max(50),
});
export type DuplicateDismissBody = z.infer<typeof duplicateDismissBodySchema>;
