'use client';

import type { Coupon, CouponBody, CouponUpdateBody, PriceBulkBody } from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

/** Lote da grade: UMA chamada com todos os preços alterados (centavos). */
export function useBulkPriceUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PriceBulkBody) =>
      adminApi.patch<{ updated: number }>('/api/pricing/prices', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.skuGrid }),
  });
}

const COUPONS = '/api/pricing/coupons';

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CouponBody) => adminApi.post<Coupon>(COUPONS, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.coupons }),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ coupon_id, body }: { coupon_id: string; body: CouponUpdateBody }) =>
      adminApi.patch<Coupon>(`${COUPONS}/${coupon_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.coupons }),
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (couponId: string) => adminApi.delete<void>(`${COUPONS}/${couponId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.coupons }),
  });
}
