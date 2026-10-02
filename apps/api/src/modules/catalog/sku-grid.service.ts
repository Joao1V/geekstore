import { Prisma, prisma } from '@geekstore/db';
import {
  type Paginated,
  type SkuGridQuery,
  type SkuGridRow,
  skuGridSortFields,
} from '@geekstore/shared';

import { asUuid, containsInsensitive, utcNow } from '../../core/db/sql';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';

type SortField = (typeof skuGridSortFields)[number];

// Expressões de ordenação fixas (o cliente só escolhe a chave): nada do `sort` vai para o SQL.
const SORT_EXPRESSIONS: Record<SortField, Prisma.Sql> = {
  code: Prisma.sql`s.code`,
  product_name: Prisma.sql`p.name`,
  price_cents: Prisma.sql`price_cents`,
  available: Prisma.sql`(COALESCE(st.on_hand, 0) - COALESCE(st.reserved, 0))`,
};

type RawGridRow = {
  sku_id: string;
  product_id: string;
  product_name: string;
  code: string;
  attributes: unknown;
  status: SkuGridRow['status'];
  price_cents: number | bigint | null;
  on_hand: number | bigint | string;
  reserved: number | bigint | string;
  thumbnail_url: string | null;
};

function buildWhere(query: SkuGridQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (query.product_id) conditions.push(Prisma.sql`s.product_id = ${asUuid(query.product_id)}`);
  if (query.q) {
    conditions.push(
      Prisma.sql`(${containsInsensitive(Prisma.sql`s.code`, query.q)} OR ${containsInsensitive(Prisma.sql`p.name`, query.q)})`
    );
  }
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

function parseAttributes(value: unknown): SkuGridRow['attributes'] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return (parsed ?? {}) as SkuGridRow['attributes'];
}

function toGridRow(row: RawGridRow): SkuGridRow {
  const onHand = Number(row.on_hand);
  const reserved = Number(row.reserved);
  return {
    sku_id: row.sku_id,
    product_id: row.product_id,
    product_name: row.product_name,
    code: row.code,
    attributes: parseAttributes(row.attributes),
    status: row.status,
    price_cents: row.price_cents === null ? null : Number(row.price_cents),
    on_hand: onHand,
    reserved,
    available: onHand - reserved,
    thumbnail_url: row.thumbnail_url,
  };
}

/**
 * Grade do admin (RF-ADM-03): SKU + produto + preço vigente do canal `site` + saldo agregado dos
 * locais vendáveis (quarentena fora). Uma única consulta com joins/subconsultas, sem N+1.
 */
export async function listSkuGrid(query: SkuGridQuery): Promise<Paginated<SkuGridRow>> {
  const { field, direction } = parseSort(query.sort, skuGridSortFields, {
    field: 'code',
    direction: 'asc',
  });
  const where = buildWhere(query);
  const { skip, take } = skipTake(query.page, query.page_size);
  const order = direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<RawGridRow[]>`
      SELECT s.sku_id, s.product_id, p.name AS product_name, s.code, s.status,
             (
               SELECT COALESCE(jsonb_object_agg(a.code, av.code), '{}'::jsonb)
               FROM sku_attribute_value sav
               JOIN attribute a ON a.attribute_id = sav.attribute_id
               JOIN attribute_value av ON av.attribute_value_id = sav.attribute_value_id
               WHERE sav.sku_id = s.sku_id
             ) AS attributes,
             (
               SELECT pr.price_cents
               FROM price pr
               JOIN channel c ON c.channel_id = pr.channel_id
               WHERE pr.sku_id = s.sku_id AND c.code = 'site'
                 AND pr.starts_at <= ${utcNow} AND (pr.ends_at IS NULL OR pr.ends_at > ${utcNow})
               ORDER BY pr.starts_at DESC
               LIMIT 1
             ) AS price_cents,
             COALESCE(st.on_hand, 0) AS on_hand,
             COALESCE(st.reserved, 0) AS reserved,
             (
               SELECT m.url
               FROM media m
               WHERE m.product_id = s.product_id AND (m.sku_id IS NULL OR m.sku_id = s.sku_id)
               ORDER BY (m.sku_id IS NOT NULL) DESC, m.position ASC, m.created_at ASC
               LIMIT 1
             ) AS thumbnail_url
      FROM sku s
      JOIN product p ON p.product_id = s.product_id
      LEFT JOIN (
        SELECT sl.sku_id, SUM(sl.on_hand) AS on_hand, SUM(sl.reserved) AS reserved
        FROM stock_level sl
        JOIN location l ON l.location_id = sl.location_id
        WHERE l.type <> 'quarantine'
        GROUP BY sl.sku_id
      ) st ON st.sku_id = s.sku_id
      ${where}
      ORDER BY ${SORT_EXPRESSIONS[field]} ${order} NULLS LAST, s.code ASC
      LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: number | bigint }[]>`
      SELECT COUNT(*) AS total
      FROM sku s
      JOIN product p ON p.product_id = s.product_id
      ${where}`,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  return { data: rows.map(toGridRow), meta: buildMeta(query.page, query.page_size, total) };
}
