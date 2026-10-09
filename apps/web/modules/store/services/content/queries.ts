import type { StorePage, StorePageLink } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api';

// Conteúdo público (sem login). O cache de 60 s alivia a API; uma edição no admin aparece em até 1 min.
const server = { next: { revalidate: 60 } } as const;

export const storePageLinksQuery = () =>
  queryOptions({
    queryKey: ['store', 'pages'],
    queryFn: () => api.get<StorePageLink[]>('/api/store/pages', undefined, server),
  });

export const storePageQuery = (slug: string) =>
  queryOptions({
    queryKey: ['store', 'pages', slug],
    queryFn: () =>
      api.get<StorePage>(`/api/store/pages/${encodeURIComponent(slug)}`, undefined, server),
  });
