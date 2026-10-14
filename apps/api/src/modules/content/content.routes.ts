import {
  bannerBodySchema,
  bannerListResponseSchema,
  bannerOrderBodySchema,
  bannerParamsSchema,
  bannerResponseSchema,
  bannerUpdateBodySchema,
  pageBodySchema,
  pageListResponseSchema,
  pageParamsSchema,
  pageResponseSchema,
  pageUpdateBodySchema,
  redirectBodySchema,
  redirectListQuerySchema,
  redirectListResponseSchema,
  redirectMapResponseSchema,
  redirectParamsSchema,
  redirectResponseSchema,
  redirectUpdateBodySchema,
  storeBannerListResponseSchema,
  storePageListResponseSchema,
  storePageParamsSchema,
  storePageResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  createBannerController,
  createPageController,
  createRedirectController,
  deleteBannerController,
  deletePageController,
  deleteRedirectController,
  getPageController,
  getStorePageController,
  listBannersController,
  listPagesController,
  listRedirectsController,
  listStoreBannersController,
  listStorePagesController,
  reorderBannersController,
  storeRedirectMapController,
  updateBannerController,
  updatePageController,
  updateRedirectController,
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

  app.get(
    '/banners',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista os banners da home, na ordem',
        response: { 200: bannerListResponseSchema },
      },
    },
    listBannersController
  );
  app.post(
    '/banners',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria banner (entra no fim da ordem)',
        body: bannerBodySchema,
        response: { 201: bannerResponseSchema },
      },
    },
    createBannerController
  );
  // `/banners/order` vem antes de `/banners/:banner_id` só por clareza: o método é outro (PUT).
  app.put(
    '/banners/order',
    {
      ...write,
      schema: {
        tags,
        summary: 'Define a ordem dos banners (a lista completa dos ids)',
        body: bannerOrderBodySchema,
        response: { 200: bannerListResponseSchema },
      },
    },
    reorderBannersController
  );
  app.patch(
    '/banners/:banner_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita banner (só o que for enviado)',
        params: bannerParamsSchema,
        body: bannerUpdateBodySchema,
        response: { 200: bannerResponseSchema },
      },
    },
    updateBannerController
  );
  app.delete(
    '/banners/:banner_id',
    {
      ...write,
      schema: { tags, summary: 'Apaga banner (204)', params: bannerParamsSchema },
    },
    deleteBannerController
  );

  app.get(
    '/redirects',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista os redirecionamentos 301 (busca por endereço ou nota; filtro por origem)',
        querystring: redirectListQuerySchema,
        response: { 200: redirectListResponseSchema },
      },
    },
    listRedirectsController
  );
  app.post(
    '/redirects',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria redirecionamento 301 (endereço antigo -> novo)',
        body: redirectBodySchema,
        response: { 201: redirectResponseSchema },
      },
    },
    createRedirectController
  );
  app.patch(
    '/redirects/:redirect_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita redirecionamento (só o que for enviado)',
        params: redirectParamsSchema,
        body: redirectUpdateBodySchema,
        response: { 200: redirectResponseSchema },
      },
    },
    updateRedirectController
  );
  app.delete(
    '/redirects/:redirect_id',
    {
      ...write,
      schema: { tags, summary: 'Apaga redirecionamento (204)', params: redirectParamsSchema },
    },
    deleteRedirectController
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

/** Loja (público): os banners que estão no ar agora. Prefixo `/api/store/banners`. */
export async function storeBannerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        tags: ['Vitrine'],
        summary: 'Banners ativos da home (dentro da janela de datas), na ordem',
        response: { 200: storeBannerListResponseSchema },
      },
    },
    listStoreBannersController
  );
}

/** Loja (público): o mapa completo de redirecionamentos 301. Prefixo `/api/store/redirects`. */
export async function storeRedirectRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        tags: ['Vitrine'],
        summary: 'Mapa de redirecionamentos 301 ([endereço antigo, endereço novo]), para o site',
        response: { 200: redirectMapResponseSchema },
      },
    },
    storeRedirectMapController
  );
}
