import { z } from 'zod';

import { dataResponse, isoDateTimeSchema, paginatedResponse, paginationQuerySchema } from './common';

export const outboxStatusSchema = z.enum(['pending', 'published', 'failed']);
export type OutboxStatus = z.infer<typeof outboxStatusSchema>;

export const outboxEventSchema = z.object({
  outbox_event_id: z.string().uuid(),
  type: z.string(),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  status: outboxStatusSchema,
  attempts: z.number().int(),
  last_error: z.string().nullable(),
  available_at: isoDateTimeSchema,
  created_at: isoDateTimeSchema,
  published_at: isoDateTimeSchema.nullable(),
});
export type OutboxEvent = z.infer<typeof outboxEventSchema>;

export const outboxListQuerySchema = paginationQuerySchema.extend({
  status: outboxStatusSchema.optional(),
  type: z.string().max(64).optional(),
});
export type OutboxListQuery = z.infer<typeof outboxListQuerySchema>;
export const outboxListResponseSchema = paginatedResponse(outboxEventSchema);

export const outboxParamsSchema = z.object({ outbox_event_id: z.string().uuid() });
export const outboxRetryResponseSchema = dataResponse(outboxEventSchema);

export const outboxSummarySchema = z.object({ pending: z.number().int(), failed: z.number().int() });
export type OutboxSummary = z.infer<typeof outboxSummarySchema>;
export const outboxSummaryResponseSchema = dataResponse(outboxSummarySchema);
