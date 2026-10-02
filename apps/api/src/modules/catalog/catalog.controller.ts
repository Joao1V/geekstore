import type {
  CategoryBody,
  CategoryParams,
  CategoryUpdateBody,
  CollectionBody,
  CollectionProductsBody,
  CollectionUpdateBody,
  MediaBody,
  MediaUpdateBody,
  MediaUploadUrlBody,
  ProductBody,
  ProductListQuery,
  ProductParams,
  ProductUpdateBody,
  SkuBody,
  SkuGridQuery,
} from '@geekstore/shared';
import type { FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify';

import { createCategory, deleteCategory, listCategories, updateCategory } from './category.service';
import {
  createCollection,
  deleteCollection,
  listCollectionProducts,
  listCollections,
  replaceCollectionProducts,
  updateCollection,
} from './collection.service';
import { createMedia, deleteMedia, updateMedia } from './media.service';
import { createUploadUrl } from './media.storage';
import {
  archiveProduct,
  createProduct,
  getProductDetail,
  listProducts,
  updateProduct,
} from './product.service';
import { getProductSummary } from './product-summary';
import type { SkuUpdateRequest } from './schemas/sku-update';
import { createSku, updateSku } from './sku.service';
import { listSkuGrid } from './sku-grid.service';

type Req<G extends RouteGenericInterface> = FastifyRequest<G>;

// ── Categorias ─────────────────────────────────────────────────────────────────
export async function listCategoriesController() {
  return { data: await listCategories() };
}

export async function createCategoryController(
  request: Req<{ Body: CategoryBody }>,
  reply: FastifyReply
) {
  const data = await createCategory(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateCategoryController(
  request: Req<{ Params: CategoryParams; Body: CategoryUpdateBody }>
) {
  return { data: await updateCategory(request.user.sub, request.params.category_id, request.body) };
}

export async function deleteCategoryController(
  request: Req<{ Params: CategoryParams }>,
  reply: FastifyReply
) {
  await deleteCategory(request.user.sub, request.params.category_id);
  return reply.status(204).send();
}

// ── Produtos ───────────────────────────────────────────────────────────────────
export async function listProductsController(request: Req<{ Querystring: ProductListQuery }>) {
  return listProducts(request.query);
}

export async function productSummaryController() {
  return { data: await getProductSummary() };
}

export async function createProductController(
  request: Req<{ Body: ProductBody }>,
  reply: FastifyReply
) {
  const data = await createProduct(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function getProductController(request: Req<{ Params: ProductParams }>) {
  return { data: await getProductDetail(request.params.product_id) };
}

export async function updateProductController(
  request: Req<{ Params: ProductParams; Body: ProductUpdateBody }>
) {
  return { data: await updateProduct(request.user.sub, request.params.product_id, request.body) };
}

export async function archiveProductController(
  request: Req<{ Params: ProductParams }>,
  reply: FastifyReply
) {
  await archiveProduct(request.user.sub, request.params.product_id);
  return reply.status(204).send();
}

// ── SKUs ───────────────────────────────────────────────────────────────────────
export async function listSkuGridController(request: Req<{ Querystring: SkuGridQuery }>) {
  return listSkuGrid(request.query);
}

export async function createSkuController(
  request: Req<{ Params: ProductParams; Body: SkuBody }>,
  reply: FastifyReply
) {
  const data = await createSku(request.user.sub, request.params.product_id, request.body);
  return reply.status(201).send({ data });
}

export async function updateSkuController(
  request: Req<{ Params: { sku_id: string }; Body: SkuUpdateRequest }>
) {
  return { data: await updateSku(request.user.sub, request.params.sku_id, request.body) };
}

// ── Coleções ───────────────────────────────────────────────────────────────────
export async function listCollectionsController() {
  return { data: await listCollections() };
}

export async function createCollectionController(
  request: Req<{ Body: CollectionBody }>,
  reply: FastifyReply
) {
  const data = await createCollection(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateCollectionController(
  request: Req<{ Params: { collection_id: string }; Body: CollectionUpdateBody }>
) {
  return {
    data: await updateCollection(request.user.sub, request.params.collection_id, request.body),
  };
}

export async function deleteCollectionController(
  request: Req<{ Params: { collection_id: string } }>,
  reply: FastifyReply
) {
  await deleteCollection(request.user.sub, request.params.collection_id);
  return reply.status(204).send();
}

export async function listCollectionProductsController(
  request: Req<{ Params: { collection_id: string } }>
) {
  return { data: await listCollectionProducts(request.params.collection_id) };
}

export async function replaceCollectionProductsController(
  request: Req<{ Params: { collection_id: string }; Body: CollectionProductsBody }>,
  reply: FastifyReply
) {
  await replaceCollectionProducts(
    request.user.sub,
    request.params.collection_id,
    request.body.product_ids
  );
  return reply.status(204).send();
}

// ── Mídia ──────────────────────────────────────────────────────────────────────
export async function createMediaController(
  request: Req<{ Params: ProductParams; Body: MediaBody }>,
  reply: FastifyReply
) {
  const data = await createMedia(request.params.product_id, request.body);
  return reply.status(201).send({ data });
}

export async function updateMediaController(
  request: Req<{ Params: { media_id: string }; Body: MediaUpdateBody }>
) {
  return { data: await updateMedia(request.params.media_id, request.body) };
}

export async function deleteMediaController(
  request: Req<{ Params: { media_id: string } }>,
  reply: FastifyReply
) {
  await deleteMedia(request.params.media_id);
  return reply.status(204).send();
}

export async function createUploadUrlController(request: Req<{ Body: MediaUploadUrlBody }>) {
  return { data: await createUploadUrl(request.body) };
}
