'use client';

import type {
  Attribute,
  AttributeBody,
  AttributeCreateBody,
  Brand,
  BrandBody,
  BrandUpdateBody,
  Category,
  CategoryBody,
  CategoryUpdateBody,
  Collection,
  CollectionBody,
  CollectionProductsBody,
  CollectionUpdateBody,
  DuplicateMergeBody,
  DuplicateMergeCertainResult,
  DuplicateMergeResult,
  Media,
  MediaBody,
  MediaUpdateBody,
  ProductBody,
  ProductDetail,
  ProductMoveBody,
  ProductUpdateBody,
  Sku,
  SkuBody,
  SkuUpdateBody,
} from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/admin-api';
import { uploadImageToBucket } from '../../lib/upload-image';
import { adminKeys } from '../query-keys';

const CATALOG = '/api/catalog';

// ── Categorias ─────────────────────────────────────────────────────────────────
export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryBody) => adminApi.post<Category>(`${CATALOG}/categories`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category_id, body }: { category_id: string; body: CategoryUpdateBody }) =>
      adminApi.patch<Category>(`${CATALOG}/categories/${category_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) =>
      adminApi.delete<void>(`${CATALOG}/categories/${categoryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
  });
}

// ── Produtos e SKUs ────────────────────────────────────────────────────────────
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductBody) => adminApi.post<ProductDetail>(`${CATALOG}/products`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.products });
      queryClient.invalidateQueries({ queryKey: adminKeys.skuGrid });
    },
  });
}

export type UpdateProductInput = {
  product_id: string;
  product: ProductUpdateBody;
  updatedSkus: { sku_id: string; body: SkuUpdateBody }[];
  newSkus: SkuBody[];
};

/** Salva os dados do produto e depois os SKUs (existentes via PATCH, novos via POST). */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, product, updatedSkus, newSkus }: UpdateProductInput) => {
      await adminApi.patch(`${CATALOG}/products/${product_id}`, product);
      for (const { sku_id, body } of updatedSkus) {
        await adminApi.patch<Sku>(`${CATALOG}/skus/${sku_id}`, body);
      }
      for (const body of newSkus) {
        await adminApi.post<Sku>(`${CATALOG}/products/${product_id}/skus`, body);
      }
    },
    onSettled: (_data, _error, { product_id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.productDetail(product_id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.products });
      queryClient.invalidateQueries({ queryKey: adminKeys.skuGrid });
    },
  });
}

/** DELETE do produto arquiva (não apaga). */
export function useArchiveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => adminApi.delete<void>(`${CATALOG}/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.products });
      queryClient.invalidateQueries({ queryKey: adminKeys.skuGrid });
    },
  });
}

// ── Coleções ───────────────────────────────────────────────────────────────────
export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CollectionBody) => adminApi.post<Collection>(`${CATALOG}/collections`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.collections }),
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collection_id, body }: { collection_id: string; body: CollectionUpdateBody }) =>
      adminApi.patch<Collection>(`${CATALOG}/collections/${collection_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.collections }),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collectionId: string) =>
      adminApi.delete<void>(`${CATALOG}/collections/${collectionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.collections }),
  });
}

export function useSetCollectionProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      collection_id,
      body,
    }: {
      collection_id: string;
      body: CollectionProductsBody;
    }) => adminApi.put<void>(`${CATALOG}/collections/${collection_id}/products`, body),
    onSuccess: (_data, { collection_id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.collectionProducts(collection_id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.products });
    },
  });
}

/** Troca as coleções de um produto (as demais ligações de cada coleção não mudam). */
export function useSetProductCollections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      product_id,
      collection_ids,
    }: {
      product_id: string;
      collection_ids: string[];
    }) => adminApi.put<void>(`${CATALOG}/products/${product_id}/collections`, { collection_ids }),
    onSettled: (_data, _error, { product_id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.productDetail(product_id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.collections });
    },
  });
}

// ── Mídia ──────────────────────────────────────────────────────────────────────
export type UploadImageInput = {
  product_id: string;
  file: File;
  alt: string;
  position: number;
  sku_id?: string | null;
};

/** Envia a imagem e registra a mídia no produto. */
export function useUploadProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, file, alt, position, sku_id }: UploadImageInput) => {
      const url = await uploadImageToBucket(file);
      const body: MediaBody = { url, alt, position, sku_id: sku_id ?? null };
      return adminApi.post<Media>(`${CATALOG}/products/${product_id}/media`, body);
    },
    onSettled: (_data, _error, { product_id }) =>
      queryClient.invalidateQueries({ queryKey: adminKeys.productDetail(product_id) }),
  });
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ media_id, body }: { media_id: string; body: MediaUpdateBody }) =>
      adminApi.patch<Media>(`${CATALOG}/media/${media_id}`, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.products }),
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) => adminApi.delete<void>(`${CATALOG}/media/${mediaId}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.products }),
  });
}

// ── Atributos de variação ──────────────────────────────────────────────────────
export function useCreateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AttributeCreateBody) =>
      adminApi.post<Attribute>(`${CATALOG}/attributes`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.attributes }),
  });
}

export function useUpdateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attribute_id, body }: { attribute_id: string; body: AttributeBody }) =>
      adminApi.put<Attribute>(`${CATALOG}/attributes/${attribute_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.attributes }),
  });
}

// ── Marcas ─────────────────────────────────────────────────────────────────────
export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BrandBody) => adminApi.post<Brand>(`${CATALOG}/brands`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.brands }),
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brand_id, body }: { brand_id: string; body: BrandUpdateBody }) =>
      adminApi.patch<Brand>(`${CATALOG}/brands/${brand_id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.brands });
      queryClient.invalidateQueries({ queryKey: adminKeys.products });
    },
  });
}

/** Envia a imagem do logo e grava a URL na marca. */
export function useUploadBrandLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ brand_id, file }: { brand_id: string; file: File }) => {
      const logo_url = await uploadImageToBucket(file);
      return adminApi.patch<Brand>(`${CATALOG}/brands/${brand_id}`, { logo_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.brands });
      queryClient.invalidateQueries({ queryKey: adminKeys.products });
    },
  });
}

// ── Duplicados ─────────────────────────────────────────────────────────────────
function useInvalidateAfterMerge() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      adminKeys.duplicates,
      adminKeys.products,
      adminKeys.skuGrid,
      adminKeys.dashboard,
    ]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useMergeDuplicates() {
  const invalidate = useInvalidateAfterMerge();
  return useMutation({
    mutationFn: (body: DuplicateMergeBody) =>
      adminApi.post<DuplicateMergeResult>(`${CATALOG}/duplicates/merge`, body),
    onSuccess: invalidate,
  });
}

export function useMergeCertainDuplicates() {
  const invalidate = useInvalidateAfterMerge();
  return useMutation({
    mutationFn: (dryRun: boolean) =>
      adminApi.post<DuplicateMergeCertainResult>(`${CATALOG}/duplicates/merge-certain`, {
        dry_run: dryRun,
      }),
    // A prévia (dry run) não muda nada: só a execução real atualiza as telas.
    onSuccess: (result) => {
      if (!result.dry_run) invalidate();
    },
  });
}

export function useDismissDuplicates() {
  const invalidate = useInvalidateAfterMerge();
  return useMutation({
    mutationFn: (skuIds: string[]) =>
      adminApi.post<void>(`${CATALOG}/duplicates/dismiss`, { sku_ids: skuIds }),
    onSuccess: invalidate,
  });
}

/** Move produtos de categoria (os escolhidos ou tudo o que o filtro mostra). */
export function useMoveProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductMoveBody) =>
      adminApi.post<{ moved: number }>(`${CATALOG}/products/move`, body),
    onSuccess: () => {
      for (const key of [
        adminKeys.products,
        adminKeys.categories,
        adminKeys.dashboard,
        adminKeys.skuGrid,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
