import type { AppError } from './app-error';
import { ConflictError } from './conflict-error';
import { NotFoundError } from './not-found-error';

type PrismaKnownError = { name: string; code: string; meta?: { modelName?: string } };

/**
 * Duck typing em vez de `instanceof`: importar `Prisma` de `@geekstore/db` abriria a conexão
 * (o módulo lê `DATABASE_URL` ao carregar) até nos testes unitários do error handler.
 */
function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/** Traduz erros conhecidos do Prisma para `AppError`; devolve `null` se não for um deles. */
export function mapPrismaError(error: unknown): AppError | null {
  if (!isPrismaKnownError(error)) return null;

  switch (error.code) {
    case 'P2002':
      return new ConflictError('Já existe um registro com esse valor único.');
    case 'P2025':
      return new NotFoundError('Registro não encontrado.');
    case 'P2003':
    case 'P2014':
      return new ConflictError('Registro referenciado por outros dados ou referência inválida.');
    case 'P2034':
      return new ConflictError('Conflito de escrita concorrente; tente novamente.');
    default:
      return null;
  }
}
