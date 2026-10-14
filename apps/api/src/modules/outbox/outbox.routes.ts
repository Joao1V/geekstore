import {
  outboxListQuerySchema,
  outboxListResponseSchema,
  outboxParamsSchema,
  outboxRetryResponseSchema,
  outboxSummaryResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import { listOutboxEvents, outboxSummary, retryEvent } from './outbox.service';

const tags = ['Eventos (outbox)'];

/** Painel dos eventos de negócio (RF-PLA-07). Prefixo: /api/outbox. */
export async function outboxRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/',
    {
      onRequest: requirePermission('queues:read'),
      schema: {
        tags,
        summary: 'Eventos pendentes, publicados e com falha, mais recentes primeiro',
        querystring: outboxListQuerySchema,
        response: { 200: outboxListResponseSchema },
      },
    },
    async (request) => listOutboxEvents(request.query)
  );
  app.get(
    '/summary',
    {
      onRequest: requirePermission('queues:read'),
      schema: {
        tags,
        summary: 'Quantos eventos esperam e quantos falharam',
        response: { 200: outboxSummaryResponseSchema },
      },
    },
    async () => ({ data: await outboxSummary() })
  );
  app.post(
    '/:outbox_event_id/retry',
    {
      onRequest: requirePermission('queues:write'),
      schema: {
        tags,
        summary: 'Reprocessa um evento: volta a pendente e é publicado de novo',
        params: outboxParamsSchema,
        response: { 200: outboxRetryResponseSchema },
      },
    },
    async (request) => ({ data: await retryEvent(request.params.outbox_event_id) })
  );
}
