import { prisma } from '@geekstore/db';
import type { ProductSummary } from '@geekstore/shared';

import { NO_PHOTO, OUT_OF_STOCK } from './product-conditions';

/** Totais dos atalhos da listagem, numa leitura só. Usa as mesmas condições da listagem. */
export async function getProductSummary(): Promise<ProductSummary> {
  const [row] = await prisma.$queryRaw<ProductSummary[]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE p.status = 'active')::int AS active,
           COUNT(*) FILTER (WHERE p.status = 'draft')::int AS draft,
           COUNT(*) FILTER (WHERE p.status = 'archived')::int AS archived,
           COUNT(*) FILTER (WHERE ${NO_PHOTO})::int AS no_photo,
           COUNT(*) FILTER (WHERE ${OUT_OF_STOCK})::int AS out_of_stock
    FROM product p`;
  return row as ProductSummary;
}
