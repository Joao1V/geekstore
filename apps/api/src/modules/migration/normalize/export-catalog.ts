import { createHash } from 'node:crypto';
import { type Prisma, prisma } from '@geekstore/db';

import {
  type NormalizedCatalog,
  type NormalizedProduct,
  type NormalizedSku,
  normalizedCatalogSchema,
} from './catalog-file';

const PAGE_SIZE = 500;

const exportInclude = {
  category: { select: { slug: true } },
  brand: { select: { name: true } },
  media: { orderBy: [{ position: 'asc' }, { created_at: 'asc' }] },
  collection_products: { select: { collection: { select: { slug: true, kind: true } } } },
  skus: {
    where: { merged_into_sku_id: null },
    orderBy: { code: 'asc' },
    include: {
      attribute_values: {
        select: { attribute: { select: { code: true } }, value: { select: { label: true } } },
      },
      prices: { where: { channel: { code: 'site' } }, orderBy: { starts_at: 'desc' } },
      stock_levels: { select: { on_hand: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type ExportRow = Prisma.ProductGetPayload<{ include: typeof exportInclude }>;
type SkuRow = ExportRow['skus'][number];

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/** Preço base = o mais recente sem "de"; promoção = o mais recente com "de" ainda vigente. */
function pricesOf(sku: SkuRow, now: Date): Pick<NormalizedSku, 'price_cents' | 'promo'> | null {
  const base = sku.prices.find(
    (price) => price.compare_at_cents === null && price.starts_at <= now
  );
  if (!base) return null;
  const promo = sku.prices.find(
    (price) =>
      price.compare_at_cents !== null &&
      price.starts_at <= now &&
      (price.ends_at === null || price.ends_at > now)
  );
  return {
    price_cents: base.price_cents,
    promo:
      promo && promo.compare_at_cents !== null
        ? {
            price_cents: promo.price_cents,
            compare_at_cents: promo.compare_at_cents,
            starts_at: iso(promo.starts_at),
            ends_at: iso(promo.ends_at),
          }
        : null,
  };
}

function toSku(sku: SkuRow, photos: string[], now: Date): NormalizedSku | null {
  const prices = pricesOf(sku, now);
  if (!prices) return null;
  return {
    code: sku.code,
    ean: sku.ean,
    manufacturer_code: sku.manufacturer_code,
    ncm: sku.ncm,
    weight_g: sku.weight_g,
    length_mm: sku.length_mm,
    width_mm: sku.width_mm,
    height_mm: sku.height_mm,
    ...prices,
    stock: sku.stock_levels.reduce((sum, level) => sum + level.on_hand, 0),
    status: sku.status,
    attributes: Object.fromEntries(
      sku.attribute_values.map((entry) => [entry.attribute.code, entry.value.label])
    ),
    photos,
  };
}

/**
 * Uma linha de produto do banco -> um produto do arquivo. Devolve `null` quando não sobra SKU
 * exportável (arquivado, mesclado em outro, ou sem preço): ele não entra no arquivo.
 */
export function toNormalizedProduct(row: ExportRow, now: Date): NormalizedProduct | null {
  if (row.status === 'archived') return null;
  const hasVariants = row.skus.some((sku) => sku.attribute_values.length > 0);
  const productPhotos = row.media.filter((media) => !media.sku_id).map((media) => media.url);
  const skus = row.skus.flatMap((sku) => {
    const own = row.media.filter((media) => media.sku_id === sku.sku_id).map((media) => media.url);
    const exported = toSku(sku, own, now);
    return exported ? [exported] : [];
  });
  if (skus.length === 0) return null;
  return {
    code: row.code,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category.slug,
    brand: row.brand?.name ?? null,
    collections: row.collection_products
      .filter((link) => link.collection.kind === 'franchise')
      .map((link) => link.collection.slug)
      .sort(),
    status: row.status,
    has_variants: hasVariants,
    photos: productPhotos,
    skus,
  };
}

/** Lê o banco inteiro (em páginas) e monta o catálogo normalizado, já validado pelo schema do arquivo. */
export async function exportCatalog(
  now: Date,
  scope: Prisma.ProductWhereInput = {}
): Promise<NormalizedCatalog> {
  const products: NormalizedProduct[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.product.findMany({
      where: { AND: [{ status: { not: 'archived' } }, scope] },
      orderBy: { product_id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { product_id: cursor }, skip: 1 } : {}),
      include: exportInclude,
    });
    if (page.length === 0) break;
    for (const row of page) {
      const product = toNormalizedProduct(row, now);
      if (product) products.push(product);
    }
    cursor = page[page.length - 1]?.product_id;
  }
  products.sort((a, b) => a.code.localeCompare(b.code));

  const used = new Set(products.flatMap((product) => product.collections));
  const collections = (
    await prisma.collection.findMany({
      where: { kind: 'franchise', slug: { in: [...used] } },
      select: { slug: true, name: true },
      orderBy: { slug: 'asc' },
    })
  ).map((collection) => ({ slug: collection.slug, name: collection.name }));

  const sourceSha256 = createHash('sha256').update(JSON.stringify(products)).digest('hex');
  return normalizedCatalogSchema.parse({
    format: 1,
    generated_at: now.toISOString(),
    source_sha256: sourceSha256,
    scope: null,
    collections,
    products,
  });
}
