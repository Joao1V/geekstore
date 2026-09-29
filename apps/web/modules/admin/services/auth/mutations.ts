'use client';

import type { AuthLoginBody, AuthSession } from '@geekstore/shared';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useLogin() {
  return useMutation({
    mutationFn: (credentials: AuthLoginBody) =>
      api.post<AuthSession>('/api/auth/login', credentials),
  });
}

/** Reata a sessão a partir do cookie HttpOnly do refresh token (rotativo). */
export function useRefreshSession() {
  return useMutation({
    mutationFn: () => api.post<AuthSession>('/api/auth/refresh'),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post<void>('/api/auth/logout'),
  });
}
