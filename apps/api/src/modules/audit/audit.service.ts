import { type Prisma, prisma } from '@geekstore/db';
import type { AuditLog, AuditLogListQuery, Paginated } from '@geekstore/shared';

import { buildMeta, skipTake } from '../../core/http/pagination';

export async function listAuditLogs(query: AuditLogListQuery): Promise<Paginated<AuditLog>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.entity_id ? { entity_id: query.entity_id } : {}),
    ...(query.user_id ? { user_id: query.user_id } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { audit_log_id: 'desc' }],
      include: { user: { select: { name: true } } },
      ...skipTake(query.page, query.page_size),
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      audit_log_id: row.audit_log_id,
      user_id: row.user_id,
      user_name: row.user?.name ?? null,
      entity: row.entity,
      entity_id: row.entity_id,
      action: row.action,
      before: row.before,
      after: row.after,
      created_at: row.created_at.toISOString(),
    })),
    meta: buildMeta(query.page, query.page_size, total),
  };
}
