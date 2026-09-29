import { z } from 'zod';

// Padrão da API (ver docs/api/common-schemas.md): JSON em snake_case; sucesso sempre em
// `{ data }` (+ `meta` nas listas); erro sempre em `{ error, code, message, details?, request_id }`.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const apiErrorCodes = [
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'request_error',
  'external_api_error',
  'serialization_error',
  'internal_error',
] as const;
export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorBodySchema = z.object({
  error: z.string(),
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
  request_id: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Resposta de sucesso de um recurso: `{ data }`. */
export function dataResponse<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema });
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  // `campo:asc` ou `campo:desc`; cada recurso valida contra a sua lista de campos permitidos.
  sort: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Resposta de lista: `{ data: T[], meta }`. */
export function paginatedResponse<T extends z.ZodType>(itemSchema: T) {
  return z.object({ data: z.array(itemSchema), meta: paginationMetaSchema });
}
export type Paginated<T> = { data: T[]; meta: PaginationMeta };
