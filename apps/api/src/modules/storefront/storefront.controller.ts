import type {
  StoreCategoriesQuery,
  StoreFilters,
  StoreProductParams,
  StoreProductsQuery,
} from '@geekstore/shared';
import type { FastifyRequest } from 'fastify';

import {
  getStoreFacets,
  getStoreHome,
  getStoreProduct,
  getStoreSitemap,
  listStoreCategories,
  listStoreProducts,
} from './storefront.service';

export async function storeHomeController() {
  return { data: await getStoreHome() };
}

export async function storeCategoriesController(
  request: FastifyRequest<{ Querystring: StoreCategoriesQuery }>
) {
  return { data: await listStoreCategories(request.query.q) };
}

export async function storeProductsController(
  request: FastifyRequest<{ Querystring: StoreProductsQuery }>
) {
  return listStoreProducts(request.query);
}

export async function storeFacetsController(
  request: FastifyRequest<{ Querystring: StoreFilters }>
) {
  return { data: await getStoreFacets(request.query) };
}

export async function storeProductController(
  request: FastifyRequest<{ Params: StoreProductParams }>
) {
  return { data: await getStoreProduct(request.params.slug) };
}

export async function storeSitemapController() {
  return { data: await getStoreSitemap() };
}
