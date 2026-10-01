import { ApiError } from '@/lib/api';

const NO_PERMISSION_MESSAGE = 'Seu perfil não tem permissão para esta ação.';

/** Mensagem amigável de qualquer erro; ramifica pelo `code`/`status`, nunca pelo texto. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'forbidden') return NO_PERMISSION_MESSAGE;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Algo deu errado. Tente novamente.';
}
