import { Prisma, prisma } from '@geekstore/db';

import { asUuid, utcNow } from '../../core/db/sql';

export type ProductListStats = {
  skuCount: number;
  skuCodes: string[];
  legacyCodes: string[];
  priceMinCents: number | null;
  priceMaxCents: number | null;
  available: number;
};

export const EMPTY_STATS: ProductListStats = {
  skuCount: 0,
  skuCodes: [],
  legacyCodes: [],
  priceMinCents: null,
  priceMaxCents: null,
  available: 0,
};

type RawStats = {
  product_id: string;
  sku_count: number;
  sku_codes: string[];
  legacy_codes: string[];
  price_min_cents: number | null;
  price_max_cents: number | null;
  available: number;
};

/**
 * SKUs, preço vigente do site e saldo disponível dos produtos de UMA página, numa consulta só
 * (nada de N+1). O saldo só olha os SKUs da página, não a tabela inteira.
 */
export async function loadListStats(productIds: string[]): Promise<Map<string, ProductListStats>> {
  if (productIds.length === 0) return new Map();
  const ids = Prisma.join(productIds.map(asUuid));

  const rows = await prisma.$queryRaw<RawStats[]>`
    SELECT s.product_id,
           COUNT(*)::int AS sku_count,
           (ARRAY_AGG(s.code ORDER BY s.code))[1:3] AS sku_codes,
           COALESCE((ARRAY_AGG(s.legacy_code ORDER BY s.code) FILTER (WHERE s.legacy_code IS NOT NULL))[1:3], '{}') AS legacy_codes,
           MIN(pr.price_cents)::int AS price_min_cents,
           MAX(pr.price_cents)::int AS price_max_cents,
           COALESCE(SUM(st.available), 0)::int AS available
    FROM sku s
    LEFT JOIN LATERAL (
      SELECT x.price_cents
      FROM price x
      JOIN channel c ON c.channel_id = x.channel_id
      WHERE x.sku_id = s.sku_id AND c.code = 'site'
        AND x.starts_at <= ${utcNow} AND (x.ends_at IS NULL OR x.ends_at > ${utcNow})
      ORDER BY x.starts_at DESC
      LIMIT 1
    ) pr ON TRUE
    LEFT JOIN (
      SELECT sl.sku_id, SUM(sl.on_hand - sl.reserved) AS available
      FROM stock_level sl
      JOIN location l ON l.location_id = sl.location_id
      WHERE l.type <> 'quarantine'
        AND sl.sku_id IN (SELECT sku_id FROM sku WHERE product_id IN (${ids}))
      GROUP BY sl.sku_id
    ) st ON st.sku_id = s.sku_id
    WHERE s.product_id IN (${ids})
    GROUP BY s.product_id`;

  return new Map(
    rows.map((row) => [
      row.product_id,
      {
        skuCount: row.sku_count,
        skuCodes: row.sku_codes,
        legacyCodes: row.legacy_codes,
        priceMinCents: row.price_min_cents,
        priceMaxCents: row.price_max_cents,
        available: row.available,
      },
    ])
  );
}
