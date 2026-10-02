import type {
  Attribute,
  Brand,
  CatalogDashboard,
  Category,
  CategoryAttribute,
  Collection,
  Product,
  ProductDetail,
  ProductListItem,
  ProductListQuery,
  ProductSummary,
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

export const catalogDashboardQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.dashboard,
    queryFn: () => adminApi.get<CatalogDashboard>('/api/catalog/dashboard'),
    staleTime: 60_000,
  });

export const brandsQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.brands,
    queryFn: () => adminApi.get<Brand[]>('/api/catalog/brands'),
    staleTime: 60_000,
  });

export const attributesQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.attributes,
    queryFn: () => adminApi.get<Attribute[]>('/api/catalog/attributes'),
    staleTime: 5 * 60_000,
  });

/** Atributos que a categoria pede (com os herdados da mãe). Sem categoria, a consulta fica parada. */
export const categoryAttributesQueryOptions = (categoryId: string) =>
  queryOptions({
    queryKey: adminKeys.categoryAttributes(categoryId),
    queryFn: () =>
      adminApi.get<CategoryAttribute[]>(`/api/catalog/categories/${categoryId}/attributes`),
    enabled: Boolean(categoryId),
  });

export const productListQueryOptions = (params: ListParams<ProductListQuery>) =>
  queryOptions({
    queryKey: adminKeys.productList(params),
    queryFn: () => adminApi.paginate<ProductListItem>('/api/catalog/products', params),
  });

export const productSummaryQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.productSummary,
    queryFn: () => adminApi.get<ProductSummary>('/api/catalog/products/summary'),
    staleTime: 30_000,
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
