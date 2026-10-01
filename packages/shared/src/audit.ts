import { z } from 'zod';

import { isoDateTimeSchema, paginatedResponse, paginationQuerySchema } from './common';

export const auditActionSchema = z.enum(['create', 'update', 'delete']);

export const auditLogSchema = z.object({
  audit_log_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  user_name: z.string().nullable(),
  entity: z.string(),
  entity_id: z.string().uuid(),
  action: auditActionSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  created_at: isoDateTimeSchema,
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditLogListQuerySchema = paginationQuerySchema.extend({
  entity: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
});
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
export const auditLogListResponseSchema = paginatedResponse(auditLogSchema);
