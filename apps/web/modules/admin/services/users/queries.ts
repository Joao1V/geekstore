import type { AdminUser, PaginationQuery } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export const userListQueryOptions = (params: Partial<PaginationQuery>) =>
  queryOptions({
    queryKey: adminKeys.userList(params),
    queryFn: () => adminApi.paginate<AdminUser>('/api/users', params),
  });
