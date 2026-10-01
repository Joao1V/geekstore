'use client';

import type {
  Category,
  CategoryBody,
  CategoryUpdateBody,
  Collection,
  CollectionBody,
  CollectionProductsBody,
  CollectionUpdateBody,
  Media,
  MediaBody,
  MediaUpdateBody,
  ProductBody,
  ProductDetail,
  ProductUpdateBody,
  Sku,
  SkuBody,
  SkuUpdateBody,
} from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/admin-api';
import { compressImage } from '../../lib/compress-image';
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

// ── Mídia ──────────────────────────────────────────────────────────────────────
type UploadUrl = { upload_url: string; public_url: string; expires_in: number };

export type UploadImageInput = {
  product_id: string;
  file: File;
  alt: string;
  position: number;
  sku_id?: string | null;
};

/** Comprime no cliente, pede a URL pré-assinada, faz o PUT direto no bucket e registra a mídia. */
export function useUploadProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, file, alt, position, sku_id }: UploadImageInput) => {
      const { blob, contentType } = await compressImage(file);
      const target = await adminApi.post<UploadUrl>(`${CATALOG}/media/upload-url`, {
        content_type: contentType,
        size_bytes: blob.size,
      });
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(target.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob,
        });
      } catch {
        throw new Error('Falha de rede ao enviar a imagem para o armazenamento.');
      }
      if (!uploadResponse.ok) throw new Error('O armazenamento recusou o envio da imagem.');
      const body: MediaBody = { url: target.public_url, alt, position, sku_id: sku_id ?? null };
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
