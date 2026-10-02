import type {
  Category,
  Collection,
  Product,
  ProductDetail,
  ProductListItem,
  ProductListQuery,
  SkuGridQuery,
  SkuGridRow,
} from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

type ListParams<T> = Partial<T>;

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.categories,
    queryFn: () => adminApi.get<Category[]>('/api/catalog/categories'),
  });

export const productListQueryOptions = (params: ListParams<ProductListQuery>) =>
  queryOptions({
    queryKey: adminKeys.productList(params),
    queryFn: () => adminApi.paginate<ProductListItem>('/api/catalog/products', params),
  });

export const productDetailQueryOptions = (productId: string) =>
  queryOptions({
    queryKey: adminKeys.productDetail(productId),
    queryFn: () => adminApi.get<ProductDetail>(`/api/catalog/products/${productId}`),
  });

export const skuGridQueryOptions = (params: ListParams<SkuGridQuery>) =>
  queryOptions({
    queryKey: adminKeys.skuGridList(params),
    queryFn: () => adminApi.paginate<SkuGridRow>('/api/catalog/skus', params),
  });

export const collectionsQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.collections,
    queryFn: () => adminApi.get<Collection[]>('/api/catalog/collections'),
  });

// CONTRATO PENDENTE: o backend ainda não expõe a leitura dos produtos (ordenados) de uma coleção.
// Assumido `GET /collections/:collection_id/products` -> `{ data: Product[] }`.
export const collectionProductsQueryOptions = (collectionId: string) =>
  queryOptions({
    queryKey: adminKeys.collectionProducts(collectionId),
    queryFn: () => adminApi.get<Product[]>(`/api/catalog/collections/${collectionId}/products`),
  });
