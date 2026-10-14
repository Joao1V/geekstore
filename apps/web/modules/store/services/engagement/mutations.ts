'use client';

import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';

type Ok = { ok: true };

export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: (email: string) => api.post<Ok>('/api/store/newsletter', { email }),
  });
}

export function useConfirmNewsletter() {
  return useMutation({
    mutationFn: (token: string) => api.post<Ok>('/api/store/newsletter/confirm', { token }),
  });
}

export function useUnsubscribeNewsletter() {
  return useMutation({
    mutationFn: (token: string) => api.post<Ok>('/api/store/newsletter/unsubscribe', { token }),
  });
}

export function useStockAlert() {
  return useMutation({
    mutationFn: (body: { sku_id: string; email: string }) =>
      api.post<Ok>('/api/store/stock-alerts', body),
  });
}
