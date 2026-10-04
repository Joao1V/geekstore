import { prisma } from '@geekstore/db';
import type { OrderListQuery, OrderSummary, Paginated } from '@geekstore/shared';

import { buildMeta, skipTake } from '../../core/http/pagination';
import { orderInclude, toOrderSummary } from './order-mapper';

/** Histórico de pedidos de quem está logado, do mais novo para o mais antigo. */
export async function listCustomerOrders(
  customerId: string,
  query: OrderListQuery
): Promise<Paginated<OrderSummary>> {
  const where = { customer_id: customerId };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: [{ created_at: 'desc' }, { number: 'desc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.order.count({ where }),
  ]);
  return { data: rows.map(toOrderSummary), meta: buildMeta(query.page, query.page_size, total) };
}
