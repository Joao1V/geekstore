import type { AuditLogListQuery } from '@geekstore/shared';
import type { FastifyRequest } from 'fastify';

import { listAuditLogs } from './audit.service';

export function listAuditLogsController(
  request: FastifyRequest<{ Querystring: AuditLogListQuery }>
) {
  return listAuditLogs(request.query);
}
