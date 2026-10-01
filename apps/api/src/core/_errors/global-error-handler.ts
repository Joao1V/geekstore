import { STATUS_CODES } from 'node:http';
import type { ApiErrorBody, ApiErrorCode } from '@geekstore/shared';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';

import { AppError } from './app-error';
import { ExternalApiError } from './external-api-error';
import { mapPrismaError } from './map-prisma-error';

const RATE_LIMITED_STATUS = 429;

/** Formato canônico de toda resposta de erro da API (contrato em `@geekstore/shared`). */
export type ErrorBody = ApiErrorBody;

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
  requestId: string,
  error: string,
  code: ApiErrorCode,
  message: string,
  details?: unknown
): ErrorBody {
  const body = { error, code, message, request_id: requestId };
  return details !== undefined ? { ...body, details } : body;
}

export const errorHandler: FastifyErrorHandler = (rawError, request: FastifyRequest, reply) => {
  const error = mapPrismaError(rawError) ?? rawError;

  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply
      .status(400)
      .send(
        buildErrorBody(
          request.id,
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
          request.id,
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
      .send(buildErrorBody(request.id, error.error, error.code, error.message, error.details));
  }

  if (error instanceof AppError) {
    if (error.status_code >= 500) {
      request.log.error({ err: error }, error.message);
    }
    return reply
      .status(error.status_code)
      .send(buildErrorBody(request.id, error.error, error.code, error.message));
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
          request.id,
          STATUS_CODES[fastifyError.statusCode] ?? 'Error',
          fastifyError.statusCode === RATE_LIMITED_STATUS ? 'rate_limited' : 'request_error',
          fastifyError.message
        )
      );
  }

  request.log.error({ err: error }, 'Unexpected error');
  return reply
    .status(500)
    .send(
      buildErrorBody(
        request.id,
        'Internal Server Error',
        'internal_error',
        'An unexpected error occurred'
      )
    );
};

/** Rota inexistente: o Fastify não passa por `setErrorHandler`, então precisa do próprio handler. */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply
    .status(404)
    .send(
      buildErrorBody(
        request.id,
        'Not Found',
        'not_found',
        `Rota ${request.method} ${request.url} não encontrada`
      )
    );
}
