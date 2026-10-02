import type {
  StoreCategory,
  StoreFacets,
  StoreFilters,
  StoreHome,
  StoreProductCard,
  StoreProductDetail,
  StoreProductsQuery,
} from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { type ApiParams, api } from '@/lib/api';

// Vitrine pública (sem login). No servidor (páginas) a chamada vai direto à API; no browser (busca
// do cabeçalho, favoritos) passa pelo proxy do Next. O cache de 60 s alivia a API nas páginas.
const REVALIDATE_SECONDS = 60;
const server = { next: { revalidate: REVALIDATE_SECONDS } } as const;

type ProductsParams = Partial<Omit<StoreProductsQuery, 'page_size'>> & { page_size?: number };

export const storeHomeQuery = () =>
  queryOptions({
    queryKey: ['store', 'home'],
    queryFn: () => api.get<StoreHome>('/api/store/home', undefined, server),
  });

export const storeCategoriesQuery = () =>
  queryOptions({
    queryKey: ['store', 'categories'],
    queryFn: () => api.get<StoreCategory[]>('/api/store/categories', undefined, server),
  });

export const storeProductsQuery = (params: ProductsParams) =>
  queryOptions({
    queryKey: ['store', 'products', params],
    queryFn: () =>
      api.paginate<StoreProductCard>('/api/store/products', params as ApiParams, server),
  });

export const storeFacetsQuery = (params: StoreFilters) =>
  queryOptions({
    queryKey: ['store', 'facets', params],
    queryFn: () => api.get<StoreFacets>('/api/store/products/facets', params as ApiParams, server),
  });

export const storeProductQuery = (slug: string) =>
  queryOptions({
    queryKey: ['store', 'product', slug],
    queryFn: () =>
      api.get<StoreProductDetail>(
        `/api/store/products/${encodeURIComponent(slug)}`,
        undefined,
        server
      ),
  });
