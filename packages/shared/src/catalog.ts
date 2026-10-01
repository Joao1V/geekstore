import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';

const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug em minúsculas, números e hífens');

const seoFields = {
  seo_title: z.string().max(255).nullable(),
  seo_description: z.string().max(500).nullable(),
  canonical_url: z.string().url().max(500).nullable(),
};

// ── Categoria (árvore de até 3 níveis) ─────────────────────────────────────────
export const categorySchema = z.object({
  category_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  featured: z.boolean(),
  position: z.number().int(),
  ...seoFields,
});
export type Category = z.infer<typeof categorySchema>;

const categoryFields = {
  parent_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(255),
  slug: slugSchema,
  featured: z.boolean(),
  position: z.number().int().min(0),
  ...seoFields,
};

export const categoryBodySchema = z.object({
  ...categoryFields,
  parent_id: categoryFields.parent_id.default(null),
  featured: categoryFields.featured.default(false),
  position: categoryFields.position.default(0),
  seo_title: categoryFields.seo_title.default(null),
  seo_description: categoryFields.seo_description.default(null),
  canonical_url: categoryFields.canonical_url.default(null),
});
export type CategoryBody = z.infer<typeof categoryBodySchema>;

// Sem defaults: um PATCH só altera o que foi enviado (`.partial()` sobre o body reaplicaria os
// defaults e apagaria os campos omitidos).
export const categoryUpdateBodySchema = z.object(categoryFields).partial();
export type CategoryUpdateBody = z.infer<typeof categoryUpdateBodySchema>;

export const categoryParamsSchema = z.object({ category_id: z.string().uuid() });
export type CategoryParams = z.infer<typeof categoryParamsSchema>;

/** Lista plana de todas as categorias; o cliente monta a árvore por `parent_id`. */
export const categoryListResponseSchema = z.object({ data: z.array(categorySchema) });
export const categoryResponseSchema = dataResponse(categorySchema);

// ── SKU ────────────────────────────────────────────────────────────────────────
export const skuStatusSchema = z.enum(['active', 'inactive']);
export const skuAttributesSchema = z.record(z.string().min(1), z.string().min(1));

export const skuSchema = z.object({
  sku_id: z.string().uuid(),
  product_id: z.string().uuid(),
  code: z.string(),
  ean: z.string().nullable(),
  attributes: skuAttributesSchema,
  weight_g: z.number().int().nullable(),
  length_mm: z.number().int().nullable(),
  width_mm: z.number().int().nullable(),
  height_mm: z.number().int().nullable(),
  ncm: z.string().nullable(),
  cost_cents: z.number().int().nullable(),
  status: skuStatusSchema,
});
export type Sku = z.infer<typeof skuSchema>;

// `code` é imutável depois de criado: só existe no body de criação.
const skuFields = {
  code: z.string().min(1).max(64),
  ean: z
    .string()
    .regex(/^\d{8,14}$/, 'EAN/GTIN com 8 a 14 dígitos')
    .nullable(),
  attributes: skuAttributesSchema,
  weight_g: z.number().int().positive().nullable(),
  length_mm: z.number().int().positive().nullable(),
  width_mm: z.number().int().positive().nullable(),
  height_mm: z.number().int().positive().nullable(),
  ncm: z
    .string()
    .regex(/^\d{8}$/, 'NCM com 8 dígitos')
    .nullable(),
  cost_cents: z.number().int().min(0).nullable(),
  status: skuStatusSchema,
};

export const skuBodySchema = z.object({
  ...skuFields,
  ean: skuFields.ean.default(null),
  attributes: skuFields.attributes.default({}),
  weight_g: skuFields.weight_g.default(null),
  length_mm: skuFields.length_mm.default(null),
  width_mm: skuFields.width_mm.default(null),
  height_mm: skuFields.height_mm.default(null),
  ncm: skuFields.ncm.default(null),
  cost_cents: skuFields.cost_cents.default(null),
  status: skuFields.status.default('active'),
});
export type SkuBody = z.infer<typeof skuBodySchema>;

export const skuUpdateBodySchema = z.object(skuFields).omit({ code: true }).partial();
export type SkuUpdateBody = z.infer<typeof skuUpdateBodySchema>;

export const skuParamsSchema = z.object({ sku_id: z.string().uuid() });
export type SkuParams = z.infer<typeof skuParamsSchema>;
export const skuResponseSchema = dataResponse(skuSchema);

// ── Mídia ──────────────────────────────────────────────────────────────────────
export const mediaSchema = z.object({
  media_id: z.string().uuid(),
  product_id: z.string().uuid(),
  sku_id: z.string().uuid().nullable(),
  url: z.string().url(),
  alt: z.string(),
  position: z.number().int(),
});
export type Media = z.infer<typeof mediaSchema>;

const mediaFields = {
  url: z.string().url().max(500),
  alt: z.string().min(1).max(255),
  position: z.number().int().min(0),
  sku_id: z.string().uuid().nullable(),
};

export const mediaBodySchema = z.object({
  ...mediaFields,
  position: mediaFields.position.default(0),
  sku_id: mediaFields.sku_id.default(null),
});
export type MediaBody = z.infer<typeof mediaBodySchema>;

export const mediaUpdateBodySchema = z.object(mediaFields).omit({ url: true }).partial();
export type MediaUpdateBody = z.infer<typeof mediaUpdateBodySchema>;

export const mediaParamsSchema = z.object({ media_id: z.string().uuid() });
export const mediaResponseSchema = dataResponse(mediaSchema);

export const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const maxImageBytes = 5 * 1024 * 1024;

export const mediaUploadUrlBodySchema = z.object({
  content_type: z.enum(allowedImageTypes),
  size_bytes: z.number().int().positive().max(maxImageBytes),
});
export type MediaUploadUrlBody = z.infer<typeof mediaUploadUrlBodySchema>;

/** `upload_url`: PUT direto no bucket (URL pré-assinada). `public_url`: vai em `MediaBody.url`. */
export const mediaUploadUrlSchema = z.object({
  upload_url: z.string().url(),
  public_url: z.string().url(),
  expires_in: z.number().int(),
});
export const mediaUploadUrlResponseSchema = dataResponse(mediaUploadUrlSchema);

// ── Produto ────────────────────────────────────────────────────────────────────
export const productStatusSchema = z.enum(['draft', 'active', 'archived']);

export const productSchema = z.object({
  product_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  status: productStatusSchema,
  ...seoFields,
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Product = z.infer<typeof productSchema>;

export const productDetailSchema = productSchema.extend({
  skus: z.array(skuSchema),
  media: z.array(mediaSchema),
  collection_ids: z.array(z.string().uuid()),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

// Produto simples tem 1 SKU; com variação, 1 SKU por combinação (RF-CAT-04).
const productFields = {
  category_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().max(20000).nullable(),
  brand: z.string().max(120).nullable(),
  status: productStatusSchema,
  ...seoFields,
};

export const productBodySchema = z.object({
  ...productFields,
  description: productFields.description.default(null),
  brand: productFields.brand.default(null),
  status: productFields.status.default('draft'),
  seo_title: productFields.seo_title.default(null),
  seo_description: productFields.seo_description.default(null),
  canonical_url: productFields.canonical_url.default(null),
  skus: z.array(skuBodySchema).min(1),
});
export type ProductBody = z.infer<typeof productBodySchema>;

export const productUpdateBodySchema = z.object(productFields).partial();
export type ProductUpdateBody = z.infer<typeof productUpdateBodySchema>;

export const productParamsSchema = z.object({ product_id: z.string().uuid() });
export type ProductParams = z.infer<typeof productParamsSchema>;

export const productSortFields = ['name', 'created_at', 'updated_at'] as const;
export const productListQuerySchema = paginationQuerySchema.extend({
  q: z.string().min(1).optional(),
  status: productStatusSchema.optional(),
  category_id: z.string().uuid().optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productListResponseSchema = paginatedResponse(productSchema);
export const productDetailResponseSchema = dataResponse(productDetailSchema);

// ── Grade do admin (SKU + preço do site + saldo agregado) ──────────────────────
export const skuGridRowSchema = z.object({
  sku_id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  code: z.string(),
  attributes: skuAttributesSchema,
  status: skuStatusSchema,
  price_cents: z.number().int().nullable(),
  on_hand: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
});
export type SkuGridRow = z.infer<typeof skuGridRowSchema>;

export const skuGridSortFields = ['code', 'product_name', 'price_cents', 'available'] as const;
export const skuGridQuerySchema = paginationQuerySchema.extend({
  q: z.string().min(1).optional(),
  product_id: z.string().uuid().optional(),
});
export type SkuGridQuery = z.infer<typeof skuGridQuerySchema>;
export const skuGridResponseSchema = paginatedResponse(skuGridRowSchema);

// ── Coleção (franquia e curadoria manual) ──────────────────────────────────────
export const collectionKindSchema = z.enum(['franchise', 'curated']);

export const collectionSchema = z.object({
  collection_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  kind: collectionKindSchema,
  description: z.string().nullable(),
  featured: z.boolean(),
  position: z.number().int(),
});
export type Collection = z.infer<typeof collectionSchema>;

const collectionFields = {
  name: z.string().min(1).max(255),
  slug: slugSchema,
  kind: collectionKindSchema,
  description: z.string().max(20000).nullable(),
  featured: z.boolean(),
  position: z.number().int().min(0),
};

export const collectionBodySchema = z.object({
  ...collectionFields,
  kind: collectionFields.kind.default('franchise'),
  description: collectionFields.description.default(null),
  featured: collectionFields.featured.default(false),
  position: collectionFields.position.default(0),
});
export type CollectionBody = z.infer<typeof collectionBodySchema>;

export const collectionUpdateBodySchema = z.object(collectionFields).partial();
export type CollectionUpdateBody = z.infer<typeof collectionUpdateBodySchema>;

export const collectionParamsSchema = z.object({ collection_id: z.string().uuid() });

/** Substitui a lista ordenada de produtos da coleção. */
export const collectionProductsBodySchema = z.object({
  product_ids: z.array(z.string().uuid()),
});
export type CollectionProductsBody = z.infer<typeof collectionProductsBodySchema>;

/** Produtos da coleção na ordem curada (`position`). */
export const collectionProductsResponseSchema = z.object({ data: z.array(productSchema) });

export const collectionListResponseSchema = z.object({ data: z.array(collectionSchema) });
export const collectionResponseSchema = dataResponse(collectionSchema);
