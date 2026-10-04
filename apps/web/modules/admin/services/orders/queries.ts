import type { AdminOrderListQuery, AdminOrderSummary, Order } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export const orderListQueryOptions = (params: Partial<AdminOrderListQuery>) =>
  queryOptions({
    queryKey: adminKeys.orderList(params),
    queryFn: () => adminApi.paginate<AdminOrderSummary>('/api/orders', params),
  });

export const orderDetailQueryOptions = (number: number) =>
  queryOptions({
    queryKey: adminKeys.orderDetail(number),
    queryFn: () => adminApi.get<Order>(`/api/orders/${number}`),
  });
