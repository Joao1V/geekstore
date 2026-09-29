import { environmentManager, QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';

// > 0 evita refetch imediato no cliente logo depois da hidratação (guia SSR do TanStack Query).
const STALE_TIME_MS = 60_000;
const MAX_RETRIES = 1;

function shouldRetry(failureCount: number, error: Error): boolean {
  // 4xx é erro do pedido (validação, sessão, não encontrado): repetir não muda o resultado.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: STALE_TIME_MS, retry: shouldRetry } },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Servidor: sempre um client novo por request (um compartilhado vazaria dados entre usuários).
 * Browser: singleton, para o React não recriar o cache quando suspende.
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
