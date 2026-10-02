import { Prisma } from '@geekstore/db';
import type { StoreSort } from '@geekstore/shared';

import { utcNow } from '../../core/db/sql';

// Regra ÚNICA do que a vitrine mostra: produto ATIVO com ao menos um SKU ATIVO e com preço vigente
// no site. Todas as consultas da loja partem desta CTE (`vis`), então listagem, filtros, contagens
// e página do produto nunca discordam. Preço e saldo já vêm agregados por produto.

const CURRENT_SITE_PRICE = Prisma.sql`(
  SELECT x.price_cents, x.compare_at_cents
  FROM price x
  JOIN channel c ON c.channel_id = x.channel_id
  WHERE x.sku_id = k.sku_id AND c.code = 'site'
    AND x.starts_at <= ${utcNow} AND (x.ends_at IS NULL OR x.ends_at > ${utcNow})
  ORDER BY x.starts_at DESC
  LIMIT 1
)`;

/**
 * Saldo disponível (físico - reservado) do SKU `k`, só em locais vendáveis (quarentena fora).
 * Subconsulta CORRELACIONADA de propósito: usa o índice de `stock_level` por SKU. Um JOIN com a soma
 * agrupada de todos os SKUs era recalculado uma vez por produto (centenas de milhões de linhas).
 */
const SKU_AVAILABLE = Prisma.sql`(
  SELECT COALESCE(SUM(sl.on_hand - sl.reserved), 0)
  FROM stock_level sl
  JOIN location l ON l.location_id = sl.location_id
  WHERE sl.sku_id = k.sku_id AND l.type <> 'quarantine'
)`;

const visibleProducts = (materialized: boolean) =>
  Prisma.sql`vis AS ${materialized ? Prisma.sql`MATERIALIZED` : Prisma.empty} (
  SELECT p.product_id, p.slug, p.name, p.code, p.created_at, p.category_id, p.brand_id,
         agg.price_min, agg.price_max, agg.available, agg.sku_count,
         EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.product_id) AS has_photo
  FROM product p
  JOIN LATERAL (
    SELECT MIN(s.price_cents) AS price_min,
           MAX(s.price_cents) AS price_max,
           COALESCE(SUM(s.available), 0) AS available,
           COUNT(*) AS sku_count
    FROM (
      SELECT pr.price_cents, ${SKU_AVAILABLE} AS available
      FROM sku k
      JOIN LATERAL ${CURRENT_SITE_PRICE} pr ON TRUE
      WHERE k.product_id = p.product_id AND k.status = 'active'
    ) s
  ) agg ON agg.sku_count > 0
  WHERE p.status = 'active'
)`;

/**
 * Para uma página de produtos já escolhidos (`WHERE product_id IN (...)`): o Postgres só calcula o
 * preço e o saldo desses produtos.
 */
export const VISIBLE_PRODUCTS = visibleProducts(false);

/**
 * Para listar, contar e ordenar o catálogo todo: calculada UMA vez e reaproveitada. Sem isso o
 * planejador reexecuta o cálculo de cada produto durante a ordenação (12 a 28 s em 24 mil produtos).
 */
export const VISIBLE_PRODUCTS_ALL = visibleProducts(true);

export const SORT_SQL: Record<StoreSort, Prisma.Sql> = {
  // Quem tem estoque e foto aparece primeiro; depois o mais novo.
  relevance: Prisma.sql`(v.available > 0) DESC, v.has_photo DESC, v.created_at DESC`,
  price_asc: Prisma.sql`v.price_min ASC, v.created_at DESC`,
  price_desc: Prisma.sql`v.price_min DESC, v.created_at DESC`,
  newest: Prisma.sql`v.created_at DESC`,
  name: Prisma.sql`v.name ASC`,
};

/** Preço atual do SKU `k` (use dentro de uma subconsulta/LATERAL sobre `sku k`). */
export const currentSitePrice = CURRENT_SITE_PRICE;
export const skuAvailable = SKU_AVAILABLE;
