import type {
  ReceiptDetail,
  ReceiptListQuery,
  ReceiptSummary,
  SkuSuggestion,
} from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

const PURCHASING = '/api/purchasing/receipts';

export const receiptListQueryOptions = (params: Partial<ReceiptListQuery>) =>
  queryOptions({
    queryKey: adminKeys.receiptList(params),
    queryFn: () => adminApi.paginate<ReceiptSummary>(PURCHASING, params),
  });

export const receiptDetailQueryOptions = (receiptId: string) =>
  queryOptions({
    queryKey: adminKeys.receiptDetail(receiptId),
    queryFn: () => adminApi.get<ReceiptDetail>(`${PURCHASING}/${receiptId}`),
  });

/** Sugestões por nome; com `ai`, a IA escolhe entre elas (uma chamada paga: só a pedido). */
export const receiptSuggestionsQueryOptions = (receiptId: string, itemId: string, ai = false) =>
  queryOptions({
    queryKey: adminKeys.receiptSuggestions(receiptId, itemId, ai),
    queryFn: () =>
      adminApi.get<SkuSuggestion[]>(
        `${PURCHASING}/${receiptId}/items/${itemId}/suggestions`,
        ai ? { ai: 'true' } : undefined
      ),
    staleTime: 5 * 60_000,
  });
