import { z } from 'zod';

import { dataResponse, isoDateTimeSchema } from './common';
import { isSafeHref } from './markdown';

const hrefSchema = z
  .string()
  .trim()
  .min(1, 'Informe o destino do botão')
  .max(300)
  .refine(isSafeHref, 'Use um endereço da loja (/catalogo/) ou um link https://');

export const bannerSchema = z.object({
  banner_id: z.string().uuid(),
  tag: z.string().nullable(),
  /** Uma frase por linha: a 1ª em branco, a 2ª em amarelo. */
  headline: z.string(),
  text: z.string().nullable(),
  cta_label: z.string(),
  href: z.string(),
  image_url: z.string().nullable(),
  position: z.number().int(),
  is_active: z.boolean(),
  starts_at: isoDateTimeSchema.nullable(),
  ends_at: isoDateTimeSchema.nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Banner = z.infer<typeof bannerSchema>;

// Sem valores padrão aqui: o PATCH só altera o que foi enviado (os padrões ficam só no cadastro).
const bannerFields = {
  tag: z.string().trim().max(120).nullable(),
  headline: z.string().trim().min(1, 'Informe o título').max(160),
  text: z.string().trim().max(300).nullable(),
  cta_label: z.string().trim().min(1, 'Informe o texto do botão').max(60),
  href: hrefSchema,
  image_url: z.string().url().max(500).nullable(),
  is_active: z.boolean(),
  starts_at: isoDateTimeSchema.nullable(),
  ends_at: isoDateTimeSchema.nullable(),
};

/** O fim da validade precisa ser depois do início. Devolve a mensagem, ou `null` se está certo. */
export function bannerWindowIssue(input: {
  starts_at: string | null;
  ends_at: string | null;
}): string | null {
  return input.starts_at && input.ends_at && input.ends_at <= input.starts_at
    ? 'O fim da exibição precisa ser depois do início.'
    : null;
}

export const bannerBodySchema = z
  .object({
    ...bannerFields,
    tag: bannerFields.tag.default(null),
    text: bannerFields.text.default(null),
    image_url: bannerFields.image_url.default(null),
    is_active: bannerFields.is_active.default(true),
    starts_at: bannerFields.starts_at.default(null),
    ends_at: bannerFields.ends_at.default(null),
  })
  .superRefine((body, ctx) => {
    const issue = bannerWindowIssue(body);
    if (issue) ctx.addIssue({ code: 'custom', path: ['ends_at'], message: issue });
  });
export type BannerBody = z.infer<typeof bannerBodySchema>;

export const bannerUpdateBodySchema = z.object(bannerFields).partial();
export type BannerUpdateBody = z.infer<typeof bannerUpdateBodySchema>;

/** Nova ordem: a lista completa dos ids, na ordem em que devem aparecer. */
export const bannerOrderBodySchema = z.object({
  banner_ids: z.array(z.string().uuid()).min(1).max(50),
});
export type BannerOrderBody = z.infer<typeof bannerOrderBodySchema>;

export const bannerParamsSchema = z.object({ banner_id: z.string().uuid() });
export const bannerResponseSchema = dataResponse(bannerSchema);
export const bannerListResponseSchema = dataResponse(z.array(bannerSchema));

// ── Loja (público) ─────────────────────────────────────────────────────────────
export const storeBannerSchema = bannerSchema.pick({
  banner_id: true,
  tag: true,
  headline: true,
  text: true,
  cta_label: true,
  href: true,
  image_url: true,
});
export type StoreBanner = z.infer<typeof storeBannerSchema>;
export const storeBannerListResponseSchema = dataResponse(z.array(storeBannerSchema));
