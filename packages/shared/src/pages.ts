import { z } from 'zod';

import { dataResponse, isoDateTimeSchema } from './common';

export const pageStatusSchema = z.enum(['draft', 'published']);
export type PageStatus = z.infer<typeof pageStatusSchema>;

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicada',
};

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Mínimo de 3 caracteres')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use minúsculas, números e hífens');

export const pageSchema = z.object({
  page_id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  /** Markdown. */
  body: z.string(),
  status: pageStatusSchema,
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  position: z.number().int(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Page = z.infer<typeof pageSchema>;

/** Linha da lista do admin: sem o corpo, que pode ser longo. */
export const pageListItemSchema = pageSchema.pick({
  page_id: true,
  slug: true,
  title: true,
  status: true,
  position: true,
  updated_at: true,
});
export type PageListItem = z.infer<typeof pageListItemSchema>;

// Sem valores padrão aqui: o PATCH só altera o que foi enviado (os padrões ficam só no cadastro).
const pageFields = {
  slug: slugSchema,
  title: z.string().trim().min(1, 'Informe o título').max(255),
  body: z.string().max(100_000, 'Texto grande demais'),
  status: pageStatusSchema,
  seo_title: z.string().trim().max(255).nullable(),
  seo_description: z.string().trim().max(500).nullable(),
  position: z.number().int().min(0),
};

export const pageBodySchema = z.object({
  ...pageFields,
  body: pageFields.body.default(''),
  status: pageFields.status.default('draft'),
  seo_title: pageFields.seo_title.default(null),
  seo_description: pageFields.seo_description.default(null),
  position: pageFields.position.default(0),
});
export type PageBody = z.infer<typeof pageBodySchema>;

export const pageUpdateBodySchema = z.object(pageFields).partial();
export type PageUpdateBody = z.infer<typeof pageUpdateBodySchema>;

export const pageParamsSchema = z.object({ page_id: z.string().uuid() });
export const pageResponseSchema = dataResponse(pageSchema);
export const pageListResponseSchema = dataResponse(z.array(pageListItemSchema));

// ── Loja (público): só páginas publicadas ──────────────────────────────────────
export const storePageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  updated_at: isoDateTimeSchema,
});
export type StorePage = z.infer<typeof storePageSchema>;
export const storePageResponseSchema = dataResponse(storePageSchema);

export const storePageLinkSchema = z.object({ slug: z.string(), title: z.string() });
export type StorePageLink = z.infer<typeof storePageLinkSchema>;
export const storePageListResponseSchema = dataResponse(z.array(storePageLinkSchema));

export const storePageParamsSchema = z.object({ slug: z.string().min(1).max(120) });
