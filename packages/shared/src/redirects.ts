import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';

/**
 * Caminho como a loja o compara: sem domínio, query nem âncora, minúsculo, com uma barra no começo e
 * nenhuma no fim (`https://loja.com/Lego/Caixa/?x=1` -> `/lego/caixa`). A raiz é `/`.
 */
export function normalizeRedirectPath(input: string): string {
  let path = input.trim();
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  path = path.split('#')[0]?.split('?')[0] ?? '';
  try {
    path = decodeURI(path);
  } catch {
    // Endereço com % solto: fica como veio.
  }
  path = `/${path}`.replace(/\/{2,}/g, '/').toLowerCase();
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

/** Endereço de destino: caminho da própria loja, sempre com barra no fim (o padrão do site). */
export function toDestinationPath(input: string): string {
  const path = normalizeRedirectPath(input);
  return path === '/' ? '/' : `${path}/`;
}

export const redirectSourceSchema = z.enum(['tray', 'manual']);
export type RedirectSource = z.infer<typeof redirectSourceSchema>;

export const redirectSchema = z.object({
  redirect_id: z.string().uuid(),
  from_path: z.string(),
  to_path: z.string(),
  source: z.string(),
  note: z.string().nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Redirect = z.infer<typeof redirectSchema>;

const fromSchema = z
  .string()
  .trim()
  .min(1, 'Informe o endereço antigo')
  .max(600)
  .transform(normalizeRedirectPath)
  .refine((path) => path !== '/', 'A página inicial não pode ser redirecionada');
const toSchema = z
  .string()
  .trim()
  .min(1, 'Informe o endereço novo')
  .max(600)
  .refine(
    (value) => /^(\/(?!\/)|https?:\/\/)/i.test(value.trim()),
    'Use um caminho da loja (/lego/) ou o link completo da loja'
  )
  .transform(toDestinationPath);

// Sem valores padrão na edição: o PATCH só altera o que foi enviado.
export const redirectBodySchema = z.object({
  from_path: fromSchema,
  to_path: toSchema,
  note: z.string().trim().max(255).nullable().default(null),
});
export type RedirectBody = z.infer<typeof redirectBodySchema>;
export const redirectUpdateBodySchema = z
  .object({ from_path: fromSchema, to_path: toSchema, note: z.string().trim().max(255).nullable() })
  .partial();
export type RedirectUpdateBody = z.infer<typeof redirectUpdateBodySchema>;

export const redirectParamsSchema = z.object({ redirect_id: z.string().uuid() });
export const redirectListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  source: redirectSourceSchema.optional(),
});
export type RedirectListQuery = z.infer<typeof redirectListQuerySchema>;
export const redirectListResponseSchema = paginatedResponse(redirectSchema);
export const redirectResponseSchema = dataResponse(redirectSchema);

/** O mapa inteiro para o site: `[de, para]`. Só o que o proxy precisa, em formato compacto. */
export const redirectMapResponseSchema = dataResponse(z.array(z.tuple([z.string(), z.string()])));
export type RedirectMap = [string, string][];
