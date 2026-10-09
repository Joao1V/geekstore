import type { Page, PageListItem } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

const PAGES = '/api/content/pages';

export const pageListQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.pages,
    queryFn: () => adminApi.get<PageListItem[]>(PAGES),
  });

export const pageDetailQueryOptions = (pageId: string) =>
  queryOptions({
    queryKey: adminKeys.pageDetail(pageId),
    queryFn: () => adminApi.get<Page>(`${PAGES}/${pageId}`),
  });
