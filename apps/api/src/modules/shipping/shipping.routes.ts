import {
  shippingQuoteBodySchema,
  shippingQuoteResponseSchema,
  zipLookupResponseSchema,
  zipParamsSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { quoteForItems } from './shipping.service';
import { lookupZip } from './zip.service';

const tags = ['Frete'];
const RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

/** Frete e CEP, públicos (a pessoa cota antes de ter conta). Prefixo: /api/store/shipping. */
export async function shippingRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/zip/:zip',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags,
        summary: 'Endereço de um CEP (para preencher o formulário)',
        params: zipParamsSchema,
        response: { 200: zipLookupResponseSchema },
      },
    },
    async (request) => ({ data: await lookupZip(request.params.zip) })
  );
  app.post(
    '/quote',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags,
        summary: 'Opções de frete para o carrinho e o CEP (simulado)',
        body: shippingQuoteBodySchema,
        response: { 200: shippingQuoteResponseSchema },
      },
    },
    async (request) => ({ data: await quoteForItems(request.body) })
  );
}
