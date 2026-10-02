import {
  storeCategoriesResponseSchema,
  storeFacetsQuerySchema,
  storeFacetsResponseSchema,
  storeHomeResponseSchema,
  storeProductDetailResponseSchema,
  storeProductParamsSchema,
  storeProductsQuerySchema,
  storeProductsResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  storeCategoriesController,
  storeFacetsController,
  storeHomeController,
  storeProductController,
  storeProductsController,
} from './storefront.controller';

const tags = ['Vitrine'];

// Rotas PÚBLICAS (sem login): só leitura do que o cliente pode ver.
export async function storefrontRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/home',
    {
      schema: {
        tags,
        summary: 'Dados da home: categorias raiz, marcas em destaque e lançamentos',
        response: { 200: storeHomeResponseSchema },
      },
    },
    storeHomeController
  );
  app.get(
    '/categories',
    {
      schema: {
        tags,
        summary:
          'Categorias com produtos à venda (lista plana; o cliente monta a árvore por parent_id)',
        response: { 200: storeCategoriesResponseSchema },
      },
    },
    storeCategoriesController
  );
  app.get(
    '/products',
    {
      schema: {
        tags,
        summary:
          'Lista produtos à venda, com busca, categoria (inclui subcategorias), marca, preço e ordem',
        querystring: storeProductsQuerySchema,
        response: { 200: storeProductsResponseSchema },
      },
    },
    storeProductsController
  );
  app.get(
    '/products/facets',
    {
      schema: {
        tags,
        summary: 'Marcas (com contagem) e faixa de preço do que está listado',
        querystring: storeFacetsQuerySchema,
        response: { 200: storeFacetsResponseSchema },
      },
    },
    storeFacetsController
  );
  app.get(
    '/products/:slug',
    {
      schema: {
        tags,
        summary: 'Página do produto: fotos, opções (cor, tamanho…) e SKUs com preço e saldo',
        params: storeProductParamsSchema,
        response: { 200: storeProductDetailResponseSchema },
      },
    },
    storeProductController
  );
}
