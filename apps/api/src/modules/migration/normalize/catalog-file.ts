import { z } from 'zod';

// Formato do catálogo normalizado: o arquivo que a loja importa. Não traz nenhum código do ERP (o elo
// com a base antiga fica em outro arquivo, o mapa legado).
const promoSchema = z.object({
  price_cents: z.number().int().positive(),
  compare_at_cents: z.number().int().positive(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});

const skuSchema = z.object({
  code: z.string().min(1).max(64),
  ean: z.string().nullable(),
  manufacturer_code: z.string().nullable(),
  ncm: z.string().nullable(),
  weight_g: z.number().int().nullable(),
  length_mm: z.number().int().nullable(),
  width_mm: z.number().int().nullable(),
  height_mm: z.number().int().nullable(),
  price_cents: z.number().int().positive(),
  promo: promoSchema.nullable(),
  stock: z.number().int().min(0),
  status: z.enum(['active', 'inactive']),
  attributes: z.record(z.string(), z.string()),
  /** Fotos próprias da variação (numa família, a imagem troca ao escolher a cor). */
  photos: z.array(z.string()),
});

const productSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable(),
  category: z.string(),
  brand: z.string().nullable(),
  /** Franquias (coleções) do produto, pelo endereço: ["disney"]. */
  collections: z.array(z.string()),
  status: z.enum(['active', 'draft']),
  has_variants: z.boolean(),
  photos: z.array(z.string()),
  skus: z.array(skuSchema).min(1),
});

export const normalizedCatalogSchema = z.object({
  format: z.literal(1),
  generated_at: z.string(),
  source_sha256: z.string(),
  /** Categorias incluídas (piloto) ou `null` quando é o catálogo todo. */
  scope: z.array(z.string()).nullable(),
  products: z.array(productSchema),
});

export type NormalizedCatalog = z.infer<typeof normalizedCatalogSchema>;
export type NormalizedProduct = z.infer<typeof productSchema>;
export type NormalizedSku = z.infer<typeof skuSchema>;

/** Mapa para a migração futura: qual item do ERP virou qual SKU. Fica fora do catálogo de propósito. */
export type LegacyMapEntry = { sku_code: string; erp_code: string; erp_name: string };
