import { Prisma, prisma } from '@geekstore/db';
import type {
  Paginated,
  StoreBrand,
  StoreCategory,
  StoreFacets,
  StoreFilters,
  StoreHome,
  StoreProductCard,
  StoreProductDetail,
  StoreProductsQuery,
} from '@geekstore/shared';

import { NotFoundError } from '../../core/_errors';
import { asUuid, matchesSearch } from '../../core/db/sql';
import { buildMeta, skipTake } from '../../core/http/pagination';
import { categoryScope } from '../catalog/category.service';
import {
  currentSitePrice,
  SORT_SQL,
  skuAvailable,
  VISIBLE_PRODUCTS,
  VISIBLE_PRODUCTS_ALL,
} from './storefront.sql';

const NEW_ARRIVALS = 12;
const TOP_BRANDS = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 60;

// ── Filtros ───────────────────────────────────────────────────────────────────

/** Condições sobre `vis v` e `brand b`. Categoria e marca chegam como slug e viram ids antes. */
async function buildWhere(filters: StoreFilters): Promise<Prisma.Sql | null> {
  const conditions: Prisma.Sql[] = [];

  if (filters.category) {
    const category = await prisma.category.findUnique({ where: { slug: filters.category } });
    if (!category) return null; // categoria que não existe: nada a mostrar
    const ids = await categoryScope(category.category_id);
    conditions.push(Prisma.sql`v.category_id IN (${Prisma.join(ids.map(asUuid))})`);
  }
  if (filters.brand) {
    const slugs = filters.brand
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);
    if (slugs.length > 0) conditions.push(Prisma.sql`b.slug IN (${Prisma.join(slugs)})`);
  }
  if (filters.q) {
    conditions.push(Prisma.sql`(
      ${matchesSearch([Prisma.sql`v.name`, Prisma.sql`b.name`, Prisma.sql`v.code`], filters.q)}
      OR EXISTS (
        SELECT 1 FROM sku s
        WHERE s.product_id = v.product_id AND s.status = 'active'
          AND ${matchesSearch([Prisma.sql`s.code`], filters.q)}
      )
    )`);
  }
  if (filters.price_min !== undefined)
    conditions.push(Prisma.sql`v.price_max >= ${filters.price_min}`);
  if (filters.price_max !== undefined)
    conditions.push(Prisma.sql`v.price_min <= ${filters.price_max}`);
  if (filters.in_stock) conditions.push(Prisma.sql`v.available > 0`);
  if (filters.ids) {
    const ids = filters.ids
      .split(',')
      .map((id) => id.trim())
      .filter((id) => UUID_PATTERN.test(id))
      .slice(0, MAX_IDS);
    if (ids.length === 0) return null;
    conditions.push(Prisma.sql`v.product_id IN (${Prisma.join(ids.map(asUuid))})`);
  }
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

// ── Cartões ───────────────────────────────────────────────────────────────────

type CardRow = {
  product_id: string;
  slug: string;
  name: string;
  brand: string | null;
  brand_slug: string | null;
  image_url: string | null;
  category_name: string;
  category_slug: string;
  price_min: number;
  price_max: number;
  compare_at_cents: number | null;
  sku_count: number | bigint;
  available: number | bigint | string;
};

const toCard = (row: CardRow): StoreProductCard => ({
  product_id: row.product_id,
  slug: row.slug,
  name: row.name,
  brand: row.brand,
  brand_slug: row.brand_slug,
  image_url: row.image_url,
  category_name: row.category_name,
  category_slug: row.category_slug,
  price_cents: Number(row.price_min),
  price_max_cents: Number(row.price_max),
  compare_at_cents: row.compare_at_cents === null ? null : Number(row.compare_at_cents),
  sku_count: Number(row.sku_count),
  in_stock: Number(row.available) > 0,
});

/** Dados de exibição dos produtos de UMA página, na ordem dos ids recebidos. */
async function loadCards(ids: string[]): Promise<StoreProductCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<CardRow[]>`
    WITH ${VISIBLE_PRODUCTS}
    SELECT v.product_id, v.slug, v.name, v.price_min, v.price_max, v.sku_count, v.available,
           b.name AS brand, b.slug AS brand_slug,
           c.name AS category_name, c.slug AS category_slug,
           (
             SELECT m.url FROM media m
             WHERE m.product_id = v.product_id
             ORDER BY (m.sku_id IS NOT NULL), m.position, m.created_at
             LIMIT 1
           ) AS image_url,
           (
             SELECT pr.compare_at_cents
             FROM sku k
             JOIN LATERAL ${currentSitePrice} pr ON TRUE
             WHERE k.product_id = v.product_id AND k.status = 'active' AND pr.price_cents = v.price_min
             LIMIT 1
           ) AS compare_at_cents
    FROM vis v
    JOIN category c ON c.category_id = v.category_id
    LEFT JOIN brand b ON b.brand_id = v.brand_id
    WHERE v.product_id IN (${Prisma.join(ids.map(asUuid))})`;
  const byId = new Map(rows.map((row) => [row.product_id, toCard(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function listStoreProducts(
  query: StoreProductsQuery
): Promise<Paginated<StoreProductCard>> {
  const where = await buildWhere(query);
  const { skip, take } = skipTake(query.page, query.page_size);
  if (where === null) return { data: [], meta: buildMeta(query.page, query.page_size, 0) };

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<{ product_id: string }[]>`
      WITH ${VISIBLE_PRODUCTS_ALL}
      SELECT v.product_id
      FROM vis v LEFT JOIN brand b ON b.brand_id = v.brand_id
      ${where}
      ORDER BY ${SORT_SQL[query.sort]}, v.product_id
      LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: number | bigint }[]>`
      WITH ${VISIBLE_PRODUCTS_ALL}
      SELECT COUNT(*) AS total
      FROM vis v LEFT JOIN brand b ON b.brand_id = v.brand_id
      ${where}`,
  ]);

  const total = Number(totals[0]?.total ?? 0);
  const data = await loadCards(rows.map((row) => row.product_id));
  return { data, meta: buildMeta(query.page, query.page_size, total) };
}

// ── Filtros da barra lateral ──────────────────────────────────────────────────

/** Marcas e faixa de preço do que está listado (sem aplicar o próprio filtro de marca e preço). */
export async function getStoreFacets(filters: StoreFilters): Promise<StoreFacets> {
  const { brand: _brand, price_min: _min, price_max: _max, ...scope } = filters;
  const where = await buildWhere(scope);
  if (where === null) return { total: 0, brands: [], price_min_cents: null, price_max_cents: null };

  const [brands, range] = await Promise.all([
    prisma.$queryRaw<{ slug: string; name: string; product_count: number | bigint }[]>`
      WITH ${VISIBLE_PRODUCTS_ALL}
      SELECT b.slug, b.name, COUNT(*) AS product_count
      FROM vis v JOIN brand b ON b.brand_id = v.brand_id
      ${where}
      GROUP BY b.slug, b.name
      ORDER BY COUNT(*) DESC, b.name
      LIMIT 30`,
    prisma.$queryRaw<{ total: number | bigint; min: number | null; max: number | null }[]>`
      WITH ${VISIBLE_PRODUCTS_ALL}
      SELECT COUNT(*) AS total, MIN(v.price_min) AS min, MAX(v.price_max) AS max
      FROM vis v LEFT JOIN brand b ON b.brand_id = v.brand_id
      ${where}`,
  ]);
  return {
    total: Number(range[0]?.total ?? 0),
    brands: brands.map((row) => ({ ...row, product_count: Number(row.product_count) })),
    price_min_cents: range[0]?.min ?? null,
    price_max_cents: range[0]?.max ?? null,
  };
}

// ── Categorias e home ─────────────────────────────────────────────────────────

export async function listStoreCategories(): Promise<StoreCategory[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({
      select: { category_id: true, parent_id: true, name: true, slug: true, position: true },
    }),
    prisma.$queryRaw<{ category_id: string; count: number | bigint }[]>`
      WITH ${VISIBLE_PRODUCTS_ALL}
      SELECT v.category_id, COUNT(*) AS count FROM vis v GROUP BY v.category_id`,
  ]);
  const direct = new Map(counts.map((row) => [row.category_id, Number(row.count)]));
  const children = new Map<string | null, typeof categories>();
  for (const category of categories) {
    children.set(category.parent_id, [...(children.get(category.parent_id) ?? []), category]);
  }
  const total = (id: string): number =>
    (direct.get(id) ?? 0) +
    (children.get(id) ?? []).reduce((sum, child) => sum + total(child.category_id), 0);

  return categories
    .map((category) => ({ ...category, product_count: total(category.category_id) }))
    .filter((category) => category.product_count > 0)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'pt-BR'));
}

async function topBrands(): Promise<StoreBrand[]> {
  const rows = await prisma.$queryRaw<
    { slug: string; name: string; product_count: number | bigint }[]
  >`
    WITH ${VISIBLE_PRODUCTS_ALL}
    SELECT b.slug, b.name, COUNT(*) AS product_count
    FROM vis v JOIN brand b ON b.brand_id = v.brand_id AND b.is_active
    GROUP BY b.slug, b.name
    ORDER BY COUNT(*) DESC
    LIMIT ${TOP_BRANDS}`;
  return rows.map((row) => ({ ...row, product_count: Number(row.product_count) }));
}

export async function getStoreHome(): Promise<StoreHome> {
  const [categories, brands, arrivals] = await Promise.all([
    listStoreCategories(),
    topBrands(),
    // Só o que tem foto e estoque: a vitrine da home não pode ter buraco.
    prisma.$queryRaw<{ product_id: string }[]>`
      WITH ${VISIBLE_PRODUCTS_ALL}
      SELECT v.product_id FROM vis v
      WHERE v.has_photo AND v.available > 0
      ORDER BY v.created_at DESC, v.product_id
      LIMIT ${NEW_ARRIVALS}`,
  ]);
  return {
    categories: categories.filter((category) => category.parent_id === null),
    brands,
    new_arrivals: await loadCards(arrivals.map((row) => row.product_id)),
  };
}

// ── Página do produto ─────────────────────────────────────────────────────────

type SkuRow = {
  sku_id: string;
  code: string;
  price_cents: number;
  compare_at_cents: number | null;
  available: number | bigint | string | null;
};

export async function getStoreProduct(slug: string): Promise<StoreProductDetail> {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'active' },
    include: {
      brand: { select: { name: true, slug: true, is_active: true } },
      media: { orderBy: [{ position: 'asc' }, { created_at: 'asc' }] },
    },
  });
  if (!product) throw new NotFoundError('Produto não encontrado.');

  const skuRows = await prisma.$queryRaw<SkuRow[]>`
    SELECT k.sku_id, k.code, pr.price_cents, pr.compare_at_cents, ${skuAvailable} AS available
    FROM sku k
    JOIN LATERAL ${currentSitePrice} pr ON TRUE
    WHERE k.product_id = ${asUuid(product.product_id)} AND k.status = 'active'
    ORDER BY k.code`;
  if (skuRows.length === 0) throw new NotFoundError('Produto não encontrado.');

  const attributeRows = await prisma.skuAttributeValue.findMany({
    where: { sku_id: { in: skuRows.map((row) => row.sku_id) } },
    select: {
      sku_id: true,
      attribute: { select: { code: true, name: true, position: true, is_active: true } },
      value: { select: { code: true, label: true, color_hex: true, position: true } },
    },
  });

  const attributesBySku = new Map<string, Record<string, string>>();
  const optionMap = new Map<
    string,
    {
      name: string;
      position: number;
      values: Map<string, { label: string; color_hex: string | null; position: number }>;
    }
  >();
  for (const row of attributeRows) {
    attributesBySku.set(row.sku_id, {
      ...(attributesBySku.get(row.sku_id) ?? {}),
      [row.attribute.code]: row.value.code,
    });
    const option = optionMap.get(row.attribute.code) ?? {
      name: row.attribute.name,
      position: row.attribute.position,
      values: new Map(),
    };
    option.values.set(row.value.code, {
      label: row.value.label,
      color_hex: row.value.color_hex,
      position: row.value.position,
    });
    optionMap.set(row.attribute.code, option);
  }

  const options = [...optionMap]
    .sort(([, a], [, b]) => a.position - b.position)
    .map(([code, option]) => ({
      code,
      name: option.name,
      values: [...option.values]
        .sort(([, a], [, b]) => a.position - b.position)
        .map(([valueCode, value]) => ({
          code: valueCode,
          label: value.label,
          color_hex: value.color_hex,
        })),
    }));

  return {
    product_id: product.product_id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    brand: product.brand?.is_active ? { slug: product.brand.slug, name: product.brand.name } : null,
    category_path: await categoryPath(product.category_id),
    images: product.media.map((media) => ({
      url: media.url,
      alt: media.alt,
      sku_id: media.sku_id,
    })),
    options,
    skus: skuRows.map((row) => ({
      sku_id: row.sku_id,
      code: row.code,
      attributes: attributesBySku.get(row.sku_id) ?? {},
      price_cents: Number(row.price_cents),
      compare_at_cents: row.compare_at_cents === null ? null : Number(row.compare_at_cents),
      available: Math.max(0, Number(row.available ?? 0)),
    })),
  };
}

const MAX_PATH_DEPTH = 5;

async function categoryPath(categoryId: string): Promise<{ name: string; slug: string }[]> {
  const path: { name: string; slug: string }[] = [];
  let currentId: string | null = categoryId;
  for (let depth = 0; currentId && depth < MAX_PATH_DEPTH; depth++) {
    const category: { name: string; slug: string; parent_id: string | null } | null =
      await prisma.category.findUnique({
        where: { category_id: currentId },
        select: { name: true, slug: true, parent_id: true },
      });
    if (!category) break;
    path.unshift({ name: category.name, slug: category.slug });
    currentId = category.parent_id;
  }
  return path;
}
