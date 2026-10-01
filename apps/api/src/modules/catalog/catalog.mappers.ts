import type { Category, Collection, Media, Product, ProductDetail, Sku } from '@geekstore/shared';

type CategoryRow = Category & Record<string, unknown>;
type SkuRow = Omit<Sku, 'attributes'> & { attributes: unknown };
type ProductRow = Omit<Product, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export function toCategory(row: CategoryRow): Category {
  return {
    category_id: row.category_id,
    parent_id: row.parent_id,
    name: row.name,
    slug: row.slug,
    featured: row.featured,
    position: row.position,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    canonical_url: row.canonical_url,
  };
}

export function toCollection(row: Collection): Collection {
  return {
    collection_id: row.collection_id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    description: row.description,
    featured: row.featured,
    position: row.position,
  };
}

export function toSku(row: SkuRow): Sku {
  return {
    sku_id: row.sku_id,
    product_id: row.product_id,
    code: row.code,
    ean: row.ean,
    attributes: row.attributes as Sku['attributes'],
    weight_g: row.weight_g,
    length_mm: row.length_mm,
    width_mm: row.width_mm,
    height_mm: row.height_mm,
    ncm: row.ncm,
    cost_cents: row.cost_cents,
    status: row.status,
  };
}

export function toMedia(row: Media): Media {
  return {
    media_id: row.media_id,
    product_id: row.product_id,
    sku_id: row.sku_id,
    url: row.url,
    alt: row.alt,
    position: row.position,
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    product_id: row.product_id,
    category_id: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    brand: row.brand,
    status: row.status,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    canonical_url: row.canonical_url,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toProductDetail(
  row: ProductRow & {
    skus: SkuRow[];
    media: Media[];
    collection_products: { collection_id: string }[];
  }
): ProductDetail {
  return {
    ...toProduct(row),
    skus: row.skus.map(toSku),
    media: row.media.map(toMedia),
    collection_ids: row.collection_products.map((link) => link.collection_id),
  };
}
