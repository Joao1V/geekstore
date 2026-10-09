import {
  pageBodySchema,
  pageListResponseSchema,
  pageParamsSchema,
  pageResponseSchema,
  pageUpdateBodySchema,
  storePageListResponseSchema,
  storePageParamsSchema,
  storePageResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  createPageController,
  deletePageController,
  getPageController,
  getStorePageController,
  listPagesController,
  listStorePagesController,
  updatePageController,
} from './page.controller';

const tags = ['Conteúdo'];

/** Admin: páginas institucionais (`content:read` / `content:write`). Prefixo `/api/content`. */
export async function contentRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const read = { onRequest: requirePermission('content:read') };
  const write = { onRequest: requirePermission('content:write') };

  app.get(
    '/pages',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista as páginas institucionais',
        response: { 200: pageListResponseSchema },
      },
    },
    listPagesController
  );
  app.get(
    '/pages/:page_id',
    {
      ...read,
      schema: {
        tags,
        summary: 'Página com o texto completo (Markdown)',
        params: pageParamsSchema,
        response: { 200: pageResponseSchema },
      },
    },
    getPageController
  );
  app.post(
    '/pages',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria página (rascunho por padrão)',
        body: pageBodySchema,
        response: { 201: pageResponseSchema },
      },
    },
    createPageController
  );
  app.patch(
    '/pages/:page_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita página (publicada não troca de endereço; não publica sem texto)',
        params: pageParamsSchema,
        body: pageUpdateBodySchema,
        response: { 200: pageResponseSchema },
      },
    },
    updatePageController
  );
  app.delete(
    '/pages/:page_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Apaga página em rascunho (a publicada precisa ser despublicada antes) (204)',
        params: pageParamsSchema,
      },
    },
    deletePageController
  );
}

/** Loja (público): só as páginas publicadas. Prefixo `/api/store/pages`. */
export async function storePageRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.get(
    '/',
    {
      schema: {
        tags: ['Vitrine'],
        summary: 'Links das páginas publicadas (rodapé da loja)',
        response: { 200: storePageListResponseSchema },
      },
    },
    listStorePagesController
  );
  app.get(
    '/:slug',
    {
      schema: {
        tags: ['Vitrine'],
        summary: 'Página institucional publicada',
        params: storePageParamsSchema,
        response: { 200: storePageResponseSchema },
      },
    },
    getStorePageController
  );
}
