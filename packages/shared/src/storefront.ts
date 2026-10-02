import { z } from 'zod';

import { dataResponse, paginatedResponse, paginationQuerySchema } from './common';

// Contratos da vitrine pública (sem login): o que o cliente vê. Só entra produto ativo com ao
// menos um SKU ativo e com preço vigente no site; dinheiro em centavos.

export const storeCategorySchema = z.object({
  category_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  position: z.number().int(),
  /** Produtos à venda na categoria e nas subcategorias. */
  product_count: z.number().int(),
});
export type StoreCategory = z.infer<typeof storeCategorySchema>;
export const storeCategoriesResponseSchema = dataResponse(z.array(storeCategorySchema));

export const storeBrandSchema = z.object({
  slug: z.string(),
  name: z.string(),
  product_count: z.number().int(),
});
export type StoreBrand = z.infer<typeof storeBrandSchema>;

export const storeProductCardSchema = z.object({
  product_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  brand_slug: z.string().nullable(),
  image_url: z.string().nullable(),
  category_name: z.string(),
  category_slug: z.string(),
  /** Menor preço entre os SKUs (o "a partir de"). */
  price_cents: z.number().int(),
  price_max_cents: z.number().int(),
  /** Preço "de" do SKU mais barato, quando está em promoção. */
  compare_at_cents: z.number().int().nullable(),
  sku_count: z.number().int(),
  in_stock: z.boolean(),
});
export type StoreProductCard = z.infer<typeof storeProductCardSchema>;

export const storeSortSchema = z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'name']);
export type StoreSort = z.infer<typeof storeSortSchema>;

/** Filtros da listagem; `category` e `brand` são slugs. `ids` (separados por vírgula) serve aos favoritos. */
export const storeFiltersSchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().max(255).optional(),
  brand: z.string().max(140).optional(),
  price_min: z.coerce.number().int().min(0).optional(),
  price_max: z.coerce.number().int().min(0).optional(),
  in_stock: z.stringbool().optional(),
  ids: z.string().max(1200).optional(),
});
export type StoreFilters = z.infer<typeof storeFiltersSchema>;

export const storeProductsQuerySchema = paginationQuerySchema
  .omit({ sort: true })
  .extend(storeFiltersSchema.shape)
  .extend({ sort: storeSortSchema.default('relevance') });
export type StoreProductsQuery = z.infer<typeof storeProductsQuerySchema>;
export const storeProductsResponseSchema = paginatedResponse(storeProductCardSchema);

export const storeFacetsQuerySchema = z.object(storeFiltersSchema.shape);
export const storeFacetsSchema = z.object({
  total: z.number().int(),
  brands: z.array(storeBrandSchema),
  price_min_cents: z.number().int().nullable(),
  price_max_cents: z.number().int().nullable(),
});
export type StoreFacets = z.infer<typeof storeFacetsSchema>;
export const storeFacetsResponseSchema = dataResponse(storeFacetsSchema);

export const storeHomeSchema = z.object({
  categories: z.array(storeCategorySchema),
  brands: z.array(storeBrandSchema),
  new_arrivals: z.array(storeProductCardSchema),
});
export type StoreHome = z.infer<typeof storeHomeSchema>;
export const storeHomeResponseSchema = dataResponse(storeHomeSchema);

// ── Página do produto ─────────────────────────────────────────────────────────
export const storeOptionSchema = z.object({
  code: z.string(),
  name: z.string(),
  values: z.array(
    z.object({ code: z.string(), label: z.string(), color_hex: z.string().nullable() })
  ),
});

export const storeSkuSchema = z.object({
  sku_id: z.string().uuid(),
  code: z.string(),
  /** Código do atributo -> código do valor ({ cor: 'preto', tamanho: 'gg' }). */
  attributes: z.record(z.string(), z.string()),
  price_cents: z.number().int(),
  compare_at_cents: z.number().int().nullable(),
  /** Unidades que dá para vender agora (físico - reservado). */
  available: z.number().int(),
});

export const storeProductDetailSchema = z.object({
  product_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  brand: z.object({ slug: z.string(), name: z.string() }).nullable(),
  /** Da categoria raiz até a do produto (migalhas de pão). */
  category_path: z.array(z.object({ name: z.string(), slug: z.string() })),
  images: z.array(
    z.object({ url: z.string(), alt: z.string(), sku_id: z.string().uuid().nullable() })
  ),
  /** O que varia (cor, tamanho…), só com os valores que existem nos SKUs à venda. */
  options: z.array(storeOptionSchema),
  skus: z.array(storeSkuSchema),
});
export type StoreProductDetail = z.infer<typeof storeProductDetailSchema>;
export const storeProductDetailResponseSchema = dataResponse(storeProductDetailSchema);

export const storeProductParamsSchema = z.object({ slug: z.string().min(1).max(255) });
export type StoreProductParams = z.infer<typeof storeProductParamsSchema>;
