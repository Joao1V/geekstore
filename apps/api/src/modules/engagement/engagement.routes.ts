import {
  dataResponse,
  newsletterBodySchema,
  okBodySchema,
  signedTokenBodySchema,
  stockAlertBodySchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  confirmNewsletter,
  subscribeStockAlert,
  subscribeToNewsletter,
  unsubscribeNewsletter,
} from './engagement.service';

const tags = ['Loja: relacionamento'];
const RATE_LIMIT = { max: 8, timeWindow: '1 minute' };
const okResponse = { 200: dataResponse(okBodySchema) };

/** Newsletter e "avise-me", abertos a quem ainda não tem conta. Prefixo: /api/store. */
export async function engagementRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/newsletter',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags,
        summary:
          'Pede a inscrição na newsletter (manda um e-mail de confirmação; a resposta não revela se o e-mail já existe)',
        body: newsletterBodySchema,
        response: okResponse,
      },
    },
    async (request) => {
      await subscribeToNewsletter(request.body);
      return { data: { ok: true as const } };
    }
  );
  app.post(
    '/newsletter/confirm',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags,
        summary: 'Confirma a inscrição com o link do e-mail',
        body: signedTokenBodySchema,
        response: okResponse,
      },
    },
    async (request) => {
      await confirmNewsletter(request.body.token);
      return { data: { ok: true as const } };
    }
  );
  app.post(
    '/newsletter/unsubscribe',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags,
        summary: 'Cancela a inscrição com o link do e-mail',
        body: signedTokenBodySchema,
        response: okResponse,
      },
    },
    async (request) => {
      await unsubscribeNewsletter(request.body.token);
      return { data: { ok: true as const } };
    }
  );
  app.post(
    '/stock-alerts',
    {
      config: { rateLimit: RATE_LIMIT },
      schema: {
        tags,
        summary: 'Avise-me quando um SKU esgotado voltar',
        body: stockAlertBodySchema,
        response: okResponse,
      },
    },
    async (request) => {
      await subscribeStockAlert(request.body);
      return { data: { ok: true as const } };
    }
  );
}
