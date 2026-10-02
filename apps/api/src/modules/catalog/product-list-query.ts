import { Prisma, prisma } from '@geekstore/db';
import type { ProductListQuery, productSortFields } from '@geekstore/shared';

import { asUuid, matchesSearch } from '../../core/db/sql';
import { NO_PHOTO, OUT_OF_STOCK } from './product-conditions';

type SortField = (typeof productSortFields)[number];

// Colunas de ordenação fixas (o cliente só escolhe a chave): nada do `sort` vai para o SQL.
const SORT_COLUMNS: Record<SortField, Prisma.Sql> = {
  name: Prisma.sql`p.name`,
  created_at: Prisma.sql`p.created_at`,
  updated_at: Prisma.sql`p.updated_at`,
};

/** Há filtro que o Prisma não expressa (busca sem acento, saldo disponível): a listagem vai por SQL. */
export function needsSqlQuery(query: ProductListQuery): boolean {
  return Boolean(query.q || query.issue);
}

function buildWhere(query: ProductListQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (query.q) {
    // Nome, código e endereço do produto; ou o código (SKU ou legado) de qualquer SKU dele.
    conditions.push(Prisma.sql`(
      ${matchesSearch([Prisma.sql`p.name`, Prisma.sql`p.code`, Prisma.sql`p.slug`], query.q)}
      OR EXISTS (
        SELECT 1 FROM sku s
        WHERE s.product_id = p.product_id
          AND ${matchesSearch([Prisma.sql`s.code`, Prisma.sql`s.legacy_code`], query.q)}
      )
    )`);
  }
  if (query.status) conditions.push(Prisma.sql`p.status = ${query.status}::"ProductStatus"`);
  if (query.category_id) conditions.push(Prisma.sql`p.category_id = ${asUuid(query.category_id)}`);
  if (query.issue === 'no_photo') conditions.push(NO_PHOTO);
  if (query.issue === 'out_of_stock') conditions.push(OUT_OF_STOCK);
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

/**
 * Ids da página (já ordenados) e o total, por SQL. O `contains` do Prisma só ignora maiúsculas
 * (`mode: 'insensitive'`); como os nomes misturam "POKÉMON" e "POKEMON", a busca precisa de
 * `unaccent`, que só existe em SQL. O mesmo vale para "sem estoque" (compara duas colunas).
 * Quem chama carrega as linhas e mantém essa ordem.
 */
export async function findProductIds(
  query: ProductListQuery,
  sort: { field: SortField; direction: 'asc' | 'desc' },
  window: { skip: number; take: number }
): Promise<{ ids: string[]; total: number }> {
  const where = buildWhere(query);
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
