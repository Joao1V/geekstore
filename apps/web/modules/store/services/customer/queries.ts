import type { Address } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { customerApi } from '../../lib/customer-api';
import { customerKeys } from './keys';

export const addressesQuery = () =>
  queryOptions({
    queryKey: customerKeys.addresses,
    queryFn: () => customerApi.get<Address[]>('/api/customer/addresses'),
  });

import type { Order, OrderSummary, Paginated } from '@geekstore/shared';

/** Histórico de pedidos de quem está logado, do mais novo ao mais antigo. */
export const ordersQuery = (page: number) =>
  queryOptions({
    queryKey: [...customerKeys.orders, 'list', page],
    queryFn: () =>
      customerApi.paginate<OrderSummary>('/api/customer/orders', {
        page,
        page_size: 10,
      }) as Promise<Paginated<OrderSummary>>,
  });

export const orderQuery = (number: number) =>
  queryOptions({
    queryKey: customerKeys.order(number),
    queryFn: () => customerApi.get<Order>(`/api/customer/orders/${number}`),
  });
