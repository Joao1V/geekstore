import { prisma } from '@geekstore/db';
import type { CatalogDashboard } from '@geekstore/shared';

import { utcNow } from '../../core/db/sql';
import { rootCategoryTotals } from './category-totals';
import { ISSUE_CONDITIONS } from './product-conditions';

type Counts = CatalogDashboard['products'] & CatalogDashboard['health'];

/** Painel do catálogo: totais, pendências e estoque, com as mesmas condições dos filtros da lista. */
export async function getCatalogDashboard(): Promise<CatalogDashboard> {
  const [counts, skuRows, stockRows, categories] = await Promise.all([
    prisma.$queryRaw<Counts[]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE p.status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE p.status = 'draft')::int AS draft,
             COUNT(*) FILTER (WHERE p.status = 'archived')::int AS archived,
             COUNT(*) FILTER (WHERE ${ISSUE_CONDITIONS.no_photo})::int AS no_photo,
             COUNT(*) FILTER (WHERE ${ISSUE_CONDITIONS.out_of_stock})::int AS out_of_stock,
             COUNT(*) FILTER (WHERE ${ISSUE_CONDITIONS.no_price})::int AS no_price,
             COUNT(*) FILTER (WHERE ${ISSUE_CONDITIONS.no_brand})::int AS no_brand,
             COUNT(*) FILTER (WHERE ${ISSUE_CONDITIONS.no_description})::int AS no_description,
             COUNT(*) FILTER (WHERE ${ISSUE_CONDITIONS.no_weight})::int AS no_weight
      FROM product p`,
    prisma.$queryRaw<{ total: number; active: number }[]>`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active FROM sku`,
    prisma.$queryRaw<{ units: bigint | number; value_cents: bigint | number }[]>`
      SELECT COALESCE(SUM(a.available), 0) AS units,
             COALESCE(SUM(a.available * pr.price_cents), 0) AS value_cents
      FROM (
        SELECT sl.sku_id, SUM(sl.on_hand - sl.reserved) AS available
        FROM stock_level sl
        JOIN location l ON l.location_id = sl.location_id
        WHERE l.type <> 'quarantine'
        GROUP BY sl.sku_id
      ) a
      JOIN LATERAL (
        SELECT x.price_cents
        FROM price x
        JOIN channel c ON c.channel_id = x.channel_id
        WHERE x.sku_id = a.sku_id AND c.code = 'site'
          AND x.starts_at <= ${utcNow} AND (x.ends_at IS NULL OR x.ends_at > ${utcNow})
        ORDER BY x.starts_at DESC
        LIMIT 1
      ) pr ON TRUE`,
    prisma.category.findMany({
      select: {
        category_id: true,
        parent_id: true,
        name: true,
        position: true,
        _count: { select: { products: true } },
      },
    }),
  ]);

  const c = counts[0];
  const stock = stockRows[0];
  return {
    products: {
      total: c?.total ?? 0,
      active: c?.active ?? 0,
      draft: c?.draft ?? 0,
      archived: c?.archived ?? 0,
    },
    skus: { total: skuRows[0]?.total ?? 0, active: skuRows[0]?.active ?? 0 },
    stock: { units: Number(stock?.units ?? 0), value_cents: Number(stock?.value_cents ?? 0) },
    health: {
      no_photo: c?.no_photo ?? 0,
      out_of_stock: c?.out_of_stock ?? 0,
      no_price: c?.no_price ?? 0,
      no_brand: c?.no_brand ?? 0,
      no_description: c?.no_description ?? 0,
      no_weight: c?.no_weight ?? 0,
    },
    by_category: rootCategoryTotals(categories),
  };
}
