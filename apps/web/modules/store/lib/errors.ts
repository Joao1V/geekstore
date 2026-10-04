import { ApiError } from '@/lib/api';

/** Mensagem amigável de qualquer erro; ramifica pelo `code`/`status`, nunca pelo texto. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Algo deu errado. Tente novamente.';
}
