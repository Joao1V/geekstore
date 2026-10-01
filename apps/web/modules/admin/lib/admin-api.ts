// Cliente HTTP do admin: injeta o access_token (só em memória, no store) e, num 401, renova a
// sessão UMA vez (single-flight) e repete a chamada. É o único lugar com essa lógica; os services
// usam `adminApi` em vez de `api`.

import type { AuthSession } from '@geekstore/shared';

import { ApiError, type ApiParams, type ApiRequestOptions, api } from '@/lib/api';
import { useAdminAuthStore } from '../state/auth-store';

let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshing ??= api
    .post<AuthSession>('/api/auth/refresh')
    .then((session) => {
      useAdminAuthStore.getState().setSession(session.access_token, session.user);
      return session.access_token;
    })
    .catch((error: unknown) => {
      useAdminAuthStore.getState().clearSession();
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function withAuth<T>(call: (accessToken: string | null) => Promise<T>): Promise<T> {
  try {
    return await call(useAdminAuthStore.getState().accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    return call(await refreshAccessToken());
  }
}

type ReadOptions = Omit<ApiRequestOptions, 'params' | 'accessToken'>;
type WriteOptions = Omit<ApiRequestOptions, 'accessToken'>;

export const adminApi = {
  get: <T>(path: string, params?: ApiParams, options?: ReadOptions) =>
    withAuth((accessToken) => api.get<T>(path, params, { ...options, accessToken })),
  paginate: <T>(path: string, params?: ApiParams, options?: ReadOptions) =>
    withAuth((accessToken) => api.paginate<T>(path, params, { ...options, accessToken })),
  post: <T>(path: string, body?: unknown, options?: WriteOptions) =>
    withAuth((accessToken) => api.post<T>(path, body, { ...options, accessToken })),
  put: <T>(path: string, body?: unknown, options?: WriteOptions) =>
    withAuth((accessToken) => api.put<T>(path, body, { ...options, accessToken })),
  patch: <T>(path: string, body?: unknown, options?: WriteOptions) =>
    withAuth((accessToken) => api.patch<T>(path, body, { ...options, accessToken })),
  delete: <T>(path: string, options?: WriteOptions) =>
    withAuth((accessToken) => api.delete<T>(path, { ...options, accessToken })),
};
