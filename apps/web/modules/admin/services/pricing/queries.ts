import type { Coupon, CouponListQuery, Price } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export const pricesQueryOptions = (skuId: string) =>
  queryOptions({
    queryKey: adminKeys.prices(skuId),
    queryFn: () => adminApi.get<Price[]>('/api/pricing/prices', { sku_id: skuId }),
  });

export const couponListQueryOptions = (params: Partial<CouponListQuery>) =>
  queryOptions({
    queryKey: adminKeys.couponList(params),
    queryFn: () => adminApi.paginate<Coupon>('/api/pricing/coupons', params),
  });
