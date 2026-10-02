import {
  categoryBodySchema,
  categoryListResponseSchema,
  categoryParamsSchema,
  categoryResponseSchema,
  categoryUpdateBodySchema,
  collectionBodySchema,
  collectionListResponseSchema,
  collectionParamsSchema,
  collectionProductsBodySchema,
  collectionProductsResponseSchema,
  collectionResponseSchema,
  collectionUpdateBodySchema,
  mediaBodySchema,
  mediaParamsSchema,
  mediaResponseSchema,
  mediaUpdateBodySchema,
  mediaUploadUrlBodySchema,
  mediaUploadUrlResponseSchema,
  productBodySchema,
  productDetailResponseSchema,
  productListQuerySchema,
  productListResponseSchema,
  productParamsSchema,
  productSummaryResponseSchema,
  productUpdateBodySchema,
  skuBodySchema,
  skuGridQuerySchema,
  skuGridResponseSchema,
  skuParamsSchema,
  skuResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  archiveProductController,
  createCategoryController,
  createCollectionController,
  createMediaController,
  createProductController,
  createSkuController,
  createUploadUrlController,
  deleteCategoryController,
  deleteCollectionController,
  deleteMediaController,
  getProductController,
  listCategoriesController,
  listCollectionProductsController,
  listCollectionsController,
  listProductsController,
  listSkuGridController,
  productSummaryController,
  replaceCollectionProductsController,
  updateCategoryController,
  updateCollectionController,
  updateMediaController,
  updateProductController,
  updateSkuController,
} from './catalog.controller';
import { skuUpdateRequestSchema } from './schemas/sku-update';

const tags = ['Catálogo'];
const read = { onRequest: requirePermission('catalog:read') };
const write = { onRequest: requirePermission('catalog:write') };

export async function catalogRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Categorias ───────────────────────────────────────────────────────────────
  app.get(
    '/categories',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista todas as categorias (lista plana; o cliente monta a árvore por parent_id)',
        response: { 200: categoryListResponseSchema },
      },
    },
    listCategoriesController
  );
  app.post(
    '/categories',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria categoria (máx. 3 níveis; slug único)',
        body: categoryBodySchema,
        response: { 201: categoryResponseSchema },
      },
    },
    createCategoryController
  );
  app.patch(
    '/categories/:category_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita categoria (só os campos enviados)',
        params: categoryParamsSchema,
        body: categoryUpdateBodySchema,
        response: { 200: categoryResponseSchema },
      },
    },
    updateCategoryController
  );
  app.delete(
    '/categories/:category_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Exclui categoria sem subcategorias nem produtos',
        params: categoryParamsSchema,
      },
    },
    deleteCategoryController
  );

  // ── Produtos ─────────────────────────────────────────────────────────────────
  app.get(
    '/products',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista produtos (busca q por nome, slug ou código de SKU)',
        querystring: productListQuerySchema,
        response: { 200: productListResponseSchema },
      },
    },
    listProductsController
  );
  app.get(
    '/products/summary',
    {
      ...read,
      schema: {
        tags,
        summary: 'Totais para os atalhos da listagem de produtos',
        response: { 200: productSummaryResponseSchema },
      },
    },
    productSummaryController
  );
  app.post(
    '/products',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria produto com seus SKUs numa transação',
        body: productBodySchema,
        response: { 201: productDetailResponseSchema },
      },
    },
    createProductController
  );
  app.get(
    '/products/:product_id',
    {
      ...read,
      schema: {
        tags,
        summary: 'Detalhe do produto com SKUs, mídia e coleções',
        params: productParamsSchema,
        response: { 200: productDetailResponseSchema },
      },
    },
    getProductController
  );
  app.patch(
    '/products/:product_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita produto (só os campos enviados; SKUs têm rotas próprias)',
        params: productParamsSchema,
        body: productUpdateBodySchema,
        response: { 200: productDetailResponseSchema },
      },
    },
    updateProductController
  );
  app.delete(
    '/products/:product_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Arquiva o produto (status archived); não apaga dados',
        params: productParamsSchema,
      },
    },
    archiveProductController
  );

  // ── SKUs ─────────────────────────────────────────────────────────────────────
  app.post(
    '/products/:product_id/skus',
    {
      ...write,
      schema: {
        tags,
        summary: 'Adiciona SKU a um produto (code único e imutável)',
        params: productParamsSchema,
        body: skuBodySchema,
        response: { 201: skuResponseSchema },
      },
    },
    createSkuController
  );
  app.patch(
    '/skus/:sku_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita SKU; o code é imutável (enviar outro valor é 400)',
        params: skuParamsSchema,
        body: skuUpdateRequestSchema,
        response: { 200: skuResponseSchema },
      },
    },
    updateSkuController
  );
  app.get(
    '/skus',
    {
      ...read,
      schema: {
        tags,
        summary: 'Grade de SKUs: preço do site e saldo agregado (locais vendáveis)',
        querystring: skuGridQuerySchema,
        response: { 200: skuGridResponseSchema },
      },
    },
    listSkuGridController
  );

  // ── Coleções ─────────────────────────────────────────────────────────────────
  app.get(
    '/collections',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista coleções (franquias e curadorias)',
        response: { 200: collectionListResponseSchema },
      },
    },
    listCollectionsController
  );
  app.post(
    '/collections',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria coleção',
        body: collectionBodySchema,
        response: { 201: collectionResponseSchema },
      },
    },
    createCollectionController
  );
  app.patch(
    '/collections/:collection_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita coleção (só os campos enviados)',
        params: collectionParamsSchema,
        body: collectionUpdateBodySchema,
        response: { 200: collectionResponseSchema },
      },
    },
    updateCollectionController
  );
  app.delete(
    '/collections/:collection_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Exclui coleção (os produtos não são afetados)',
        params: collectionParamsSchema,
      },
    },
    deleteCollectionController
  );
  app.get(
    '/collections/:collection_id/products',
    {
      ...read,
      schema: {
        tags,
        summary: 'Produtos da coleção, na ordem curada',
        params: collectionParamsSchema,
        response: { 200: collectionProductsResponseSchema },
      },
    },
    listCollectionProductsController
  );
  app.put(
    '/collections/:collection_id/products',
    {
      ...write,
      schema: {
        tags,
        summary: 'Substitui a lista ordenada de produtos da coleção (204)',
        params: collectionParamsSchema,
        body: collectionProductsBodySchema,
      },
    },
    replaceCollectionProductsController
  );

  // ── Mídia ────────────────────────────────────────────────────────────────────
  app.post(
    '/media/upload-url',
    {
      ...write,
      schema: {
        tags,
        summary: 'URL pré-assinada (PUT) para enviar imagem direto ao bucket',
        body: mediaUploadUrlBodySchema,
        response: { 200: mediaUploadUrlResponseSchema },
      },
    },
    createUploadUrlController
  );
  app.post(
    '/products/:product_id/media',
    {
      ...write,
      schema: {
        tags,
        summary: 'Registra imagem (já enviada ao bucket) no produto ou em um SKU dele',
        params: productParamsSchema,
        body: mediaBodySchema,
        response: { 201: mediaResponseSchema },
      },
    },
    createMediaController
  );
  app.patch(
    '/media/:media_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita texto alternativo, posição ou SKU da imagem',
        params: mediaParamsSchema,
        body: mediaUpdateBodySchema,
        response: { 200: mediaResponseSchema },
      },
    },
    updateMediaController
  );
  app.delete(
    '/media/:media_id',
    {
      ...write,
      schema: { tags, summary: 'Remove a imagem do produto', params: mediaParamsSchema },
    },
    deleteMediaController
  );
}
