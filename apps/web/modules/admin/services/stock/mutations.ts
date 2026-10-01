'use client';

import type {
  StockBulkBody,
  StockLevel,
  StockMovement,
  StockMovementBody,
} from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.skuGrid }),
      queryClient.invalidateQueries({ queryKey: adminKeys.stockLevels }),
      queryClient.invalidateQueries({ queryKey: adminKeys.movements }),
    ]);
}

export function useCreateMovement() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (body: StockMovementBody) =>
      adminApi.post<{ movement: StockMovement; level: StockLevel }>('/api/stock/movements', body),
    onSuccess: invalidate,
  });
}

/** Lote da grade: UMA chamada com todas as linhas sujas de estoque. */
export function useBulkStockUpdate() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: (body: StockBulkBody) =>
      adminApi.patch<{ updated: number }>('/api/stock/levels', body),
    onSuccess: invalidate,
  });
}
