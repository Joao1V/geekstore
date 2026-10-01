import {
  priceBulkBodySchema,
  priceBulkResponseSchema,
  priceListQuerySchema,
  priceListResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import { bulkSetPricesController, listPricesController } from './pricing.controller';

const tags = ['Preços'];

export async function pricingRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/prices',
    {
      onRequest: requirePermission('pricing:read'),
      schema: {
        tags,
        summary: 'Preço vigente do SKU em cada canal (na F1, só o site)',
        querystring: priceListQuerySchema,
        response: { 200: priceListResponseSchema },
      },
    },
    listPricesController
  );
  app.patch(
    '/prices',
    {
      onRequest: requirePermission('pricing:write'),
      schema: {
        tags,
        summary: 'Edição em lote do preço do site (novo registro de vigência por SKU alterado)',
        body: priceBulkBodySchema,
        response: { 200: priceBulkResponseSchema },
      },
    },
    bulkSetPricesController
  );
}
