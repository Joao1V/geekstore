// Cliente HTTP da conta do cliente: injeta o access_token (só em memória) e, num 401, renova a
// sessão UMA vez (single-flight) pelo cookie e repete a chamada. Os services da conta usam
// `customerApi` em vez de `api`. Espelha o `adminApi`, com sessão e cookie próprios.

import type { CustomerSession } from '@geekstore/shared';

import { ApiError, type ApiParams, type ApiRequestOptions, api } from '@/lib/api';
import { useCustomerStore } from '../state/customer-store';

let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshing ??= api
    .post<CustomerSession>('/api/customer/auth/refresh')
    .then((session) => {
      useCustomerStore.getState().setSession(session.access_token, session.customer);
      return session.access_token;
    })
    .catch((error: unknown) => {
      useCustomerStore.getState().clearSession();
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function withAuth<T>(call: (accessToken: string | null) => Promise<T>): Promise<T> {
  try {
    return await call(useCustomerStore.getState().accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    return call(await refreshAccessToken());
  }
}

type ReadOptions = Omit<ApiRequestOptions, 'params' | 'accessToken'>;
type WriteOptions = Omit<ApiRequestOptions, 'accessToken'>;

export const customerApi = {
  get: <T>(path: string, params?: ApiParams, options?: ReadOptions) =>
    withAuth((accessToken) => api.get<T>(path, params, { ...options, accessToken })),
  paginate: <T>(path: string, params?: ApiParams, options?: ReadOptions) =>
    withAuth((accessToken) => api.paginate<T>(path, params, { ...options, accessToken })),
  post: <T>(path: string, body?: unknown, options?: WriteOptions) =>
    withAuth((accessToken) => api.post<T>(path, body, { ...options, accessToken })),
  patch: <T>(path: string, body?: unknown, options?: WriteOptions) =>
    withAuth((accessToken) => api.patch<T>(path, body, { ...options, accessToken })),
  delete: <T>(path: string, options?: WriteOptions) =>
    withAuth((accessToken) => api.delete<T>(path, { ...options, accessToken })),
};
