'use client';

import type {
  Banner,
  BannerBody,
  BannerUpdateBody,
  Page,
  PageBody,
  PageUpdateBody,
} from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

const PAGES = '/api/content/pages';

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PageBody) => adminApi.post<Page>(PAGES, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.pages }),
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ page_id, body }: { page_id: string; body: PageUpdateBody }) =>
      adminApi.patch<Page>(`${PAGES}/${page_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.pages }),
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => adminApi.delete<void>(`${PAGES}/${pageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.pages }),
  });
}

const BANNERS = '/api/content/banners';

export function useCreateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BannerBody) => adminApi.post<Banner>(BANNERS, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.banners }),
  });
}

export function useUpdateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ banner_id, body }: { banner_id: string; body: BannerUpdateBody }) =>
      adminApi.patch<Banner>(`${BANNERS}/${banner_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.banners }),
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bannerId: string) => adminApi.delete<void>(`${BANNERS}/${bannerId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.banners }),
  });
}

/** A lista completa dos ids, na nova ordem. */
export function useReorderBanners() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bannerIds: string[]) =>
      adminApi.put<Banner[]>(`${BANNERS}/order`, { banner_ids: bannerIds }),
    onSuccess: (data) => queryClient.setQueryData(adminKeys.banners, data),
  });
}
