import {
  locationListResponseSchema,
  stockBulkBodySchema,
  stockBulkResponseSchema,
  stockLevelListQuerySchema,
  stockLevelListResponseSchema,
  stockMovementBodySchema,
  stockMovementListQuerySchema,
  stockMovementListResponseSchema,
  stockMovementResponseSchema,
  stockReconcileResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  bulkSetLevelsController,
  createMovementController,
  listLevelsController,
  listLocationsController,
  listMovementsController,
  reconcileController,
} from './stock.controller';

const tags = ['Estoque'];
const read = { onRequest: requirePermission('stock:read') };
const write = { onRequest: requirePermission('stock:write') };

export async function stockRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/locations',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista os locais de estoque',
        response: { 200: locationListResponseSchema },
      },
    },
    listLocationsController
  );
  app.get(
    '/levels',
    {
      ...read,
      schema: {
        tags,
        summary: 'Saldos por SKU e local (available = on_hand - reserved)',
        querystring: stockLevelListQuerySchema,
        response: { 200: stockLevelListResponseSchema },
      },
    },
    listLevelsController
  );
  app.patch(
    '/levels',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edição em lote: define o on_hand absoluto (cada mudança vira um ajuste)',
        body: stockBulkBodySchema,
        response: { 200: stockBulkResponseSchema },
      },
    },
    bulkSetLevelsController
  );
  app.get(
    '/movements',
    {
      ...read,
      schema: {
        tags,
        summary: 'Histórico de movimentações (mais recentes primeiro)',
        querystring: stockMovementListQuerySchema,
        response: { 200: stockMovementListResponseSchema },
      },
    },
    listMovementsController
  );
  app.post(
    '/movements',
    {
      ...write,
      schema: {
        tags,
        summary: 'Registra entrada, saída, ajuste ou devolução (baixa atômica, nunca negativa)',
        body: stockMovementBodySchema,
        response: { 201: stockMovementResponseSchema },
      },
    },
    createMovementController
  );
  app.get(
    '/reconcile',
    {
      ...read,
      schema: {
        tags,
        summary: 'Confere o saldo contra a soma das movimentações (RF-EST-10)',
        response: { 200: stockReconcileResponseSchema },
      },
    },
    reconcileController
  );
}
