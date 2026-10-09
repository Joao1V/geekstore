'use client';

import type { Page, PageBody, PageUpdateBody } from '@geekstore/shared';
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
