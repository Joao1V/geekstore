'use client';

import type { PriceBulkBody } from '@geekstore/shared';
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
