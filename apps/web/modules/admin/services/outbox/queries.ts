import type { OutboxEvent, OutboxListQuery, OutboxSummary } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export const outboxQueryOptions = (params: Partial<OutboxListQuery>) =>
  queryOptions({
    queryKey: adminKeys.outboxList(params),
    queryFn: () => adminApi.paginate<OutboxEvent>('/api/outbox', params),
    // Evento que acabou de falhar aparece sem recarregar.
    refetchInterval: 10_000,
  });

export const outboxSummaryQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.outboxSummary,
    queryFn: () => adminApi.get<OutboxSummary>('/api/outbox/summary'),
    refetchInterval: 10_000,
  });
