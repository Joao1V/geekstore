import type { FastifyError, FastifyInstance, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';

import { AppError } from './app-error';
import { ExternalApiError } from './external-api-error';

/**
 * Formato canônico de toda resposta de erro da API.
 */
export interface ErrorBody {
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

type FastifyErrorHandler = FastifyInstance['errorHandler'];

function buildValidationDetails(
  error: Parameters<typeof hasZodFastifySchemaValidationErrors>[0] & {
    validation?: { instancePath: string; message?: string }[];
  }
): Record<string, string[]> {
  return (
    error.validation?.reduce<Record<string, string[]>>((acc, err) => {
      const field = err.instancePath.replace(/^\//, '') || 'root';
      if (!acc[field]) acc[field] = [];
      acc[field].push(err.message ?? '');
      return acc;
    }, {}) ?? {}
  );
}

function buildErrorBody(
  error: string,
  code: string,
  message: string,
  details?: unknown
): ErrorBody {
  return details !== undefined ? { error, code, message, details } : { error, code, message };
}

export const errorHandler: FastifyErrorHandler = (error, request: FastifyRequest, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply
      .status(400)
      .send(
        buildErrorBody(
          'Bad Request',
          'validation_failed',
          'Validation failed',
          buildValidationDetails(error as Parameters<typeof buildValidationDetails>[0])
        )
      );
  }

  if (isResponseSerializationError(error)) {
    request.log.error(
      { method: request.method, url: request.url, issues: error.cause.issues },
      'Response serialization error — schema mismatch on route response'
    );
    return reply
      .status(500)
      .send(
        buildErrorBody(
          'Internal Server Error',
          'serialization_error',
          'Response serialization failed',
          error.cause.issues
        )
      );
  }

  if (error instanceof ExternalApiError) {
    request.log.error({ err: error, details: error.details }, error.message);
    return reply
      .status(error.status_code)
      .send(buildErrorBody(error.error, error.code, error.message, error.details));
  }

  if (error instanceof AppError) {
    if (error.status_code >= 500) {
      request.log.error({ err: error }, error.message);
    }
    return reply
      .status(error.status_code)
      .send(buildErrorBody(error.error, error.code, error.message));
  }

  // Erros lançados pelo próprio Fastify ou por plugins oficiais (ex.: @fastify/rate-limit,
  // limite de payload, rota não encontrada) trazem `statusCode` em vez de serem um AppError.
  const fastifyError = error as FastifyError;
  if (
    typeof fastifyError.statusCode === 'number' &&
    fastifyError.statusCode >= 400 &&
    fastifyError.statusCode < 500
  ) {
    return reply
      .status(fastifyError.statusCode)
      .send(
        buildErrorBody(
          fastifyError.name ?? 'Error',
          fastifyError.code ?? 'request_error',
          fastifyError.message
        )
      );
  }

  request.log.error({ err: error }, 'Unexpected error');
  return reply
    .status(500)
    .send(
      buildErrorBody('Internal Server Error', 'internal_error', 'An unexpected error occurred')
    );
};
