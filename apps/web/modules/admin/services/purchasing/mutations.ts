'use client';

import type { ReceiptDetail, ReceiptImportBody, ReceiptItemUpdateBody } from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

const PURCHASING = '/api/purchasing/receipts';

export function useImportReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReceiptImportBody) =>
      adminApi.post<ReceiptDetail>(`${PURCHASING}/import`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.receipts }),
  });
}

export function useUpdateReceiptItem(receiptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: ReceiptItemUpdateBody }) =>
      adminApi.patch<ReceiptDetail>(`${PURCHASING}/${receiptId}/items/${itemId}`, body),
    onSuccess: (receipt) => {
      queryClient.setQueryData(adminKeys.receiptDetail(receiptId), receipt);
      queryClient.invalidateQueries({ queryKey: adminKeys.receipts });
    },
  });
}

/** Lançar a nota mexe no estoque e no custo: tudo o que mostra saldo precisa recarregar. */
export function usePostReceipt(receiptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.post<ReceiptDetail>(`${PURCHASING}/${receiptId}/post`),
    onSuccess: (receipt) => {
      queryClient.setQueryData(adminKeys.receiptDetail(receiptId), receipt);
      for (const key of [
        adminKeys.receipts,
        adminKeys.stockLevels,
        adminKeys.movements,
        adminKeys.skuGrid,
        adminKeys.dashboard,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useDeleteReceipt(receiptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.delete<void>(`${PURCHASING}/${receiptId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.receipts }),
  });
}
