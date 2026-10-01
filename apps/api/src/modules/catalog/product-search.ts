import { Prisma, prisma } from '@geekstore/db';
import type { ProductListQuery, productSortFields } from '@geekstore/shared';

import { asUuid, containsInsensitive } from '../../core/db/sql';

type SortField = (typeof productSortFields)[number];

// Colunas de ordenação fixas (o cliente só escolhe a chave): nada do `sort` vai para o SQL.
const SORT_COLUMNS: Record<SortField, Prisma.Sql> = {
  name: Prisma.sql`p.name`,
  created_at: Prisma.sql`p.created_at`,
  updated_at: Prisma.sql`p.updated_at`,
};

function buildSearchWhere(query: ProductListQuery & { q: string }): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`(
      ${containsInsensitive(Prisma.sql`p.name`, query.q)}
      OR ${containsInsensitive(Prisma.sql`p.slug`, query.q)}
      OR EXISTS (
        SELECT 1 FROM sku s
        WHERE s.product_id = p.product_id AND ${containsInsensitive(Prisma.sql`s.code`, query.q)}
      )
    )`,
  ];
  if (query.status) conditions.push(Prisma.sql`p.status = ${query.status}::"ProductStatus"`);
  if (query.category_id) conditions.push(Prisma.sql`p.category_id = ${asUuid(query.category_id)}`);
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/**
 * Busca de produtos por nome, slug ou código de SKU, sem diferenciar maiúsculas nem acentos. O
 * `contains` do Prisma só ignora maiúsculas (`mode: 'insensitive'`); como os nomes misturam
 * "POKÉMON" e "POKEMON", a busca precisa de `unaccent`, que só existe em SQL. Devolve os ids da
 * página já ordenados e o total; quem chama carrega as linhas e mantém essa ordem.
 */
export async function searchProductIds(
  query: ProductListQuery & { q: string },
  sort: { field: SortField; direction: 'asc' | 'desc' },
  window: { skip: number; take: number }
): Promise<{ ids: string[]; total: number }> {
  const where = buildSearchWhere(query);
  const direction = sort.direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<{ product_id: string }[]>`
      SELECT p.product_id
      FROM product p
      ${where}
      ORDER BY ${SORT_COLUMNS[sort.field]} ${direction}, p.product_id ASC
      LIMIT ${window.take} OFFSET ${window.skip}`,
    prisma.$queryRaw<{ total: number | bigint }[]>`
      SELECT COUNT(*) AS total FROM product p ${where}`,
  ]);

  return { ids: rows.map((row) => row.product_id), total: Number(countRows[0]?.total ?? 0) };
}
