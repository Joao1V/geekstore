'use client';

import type { OutboxEvent } from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export function useRetryOutboxEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => adminApi.post<OutboxEvent>(`/api/outbox/${eventId}/retry`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.outbox }),
  });
}
