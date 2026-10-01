import type { AuditLog, AuditLogListQuery } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export const auditLogsQueryOptions = (params: Partial<AuditLogListQuery>) =>
  queryOptions({
    queryKey: adminKeys.auditLogs(params),
    queryFn: () => adminApi.paginate<AuditLog>('/api/audit-logs', params),
  });
