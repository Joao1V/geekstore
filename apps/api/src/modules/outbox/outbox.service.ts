import { type Prisma, prisma } from '@geekstore/db';
import type { OutboxEvent, OutboxListQuery, OutboxSummary, Paginated } from '@geekstore/shared';

import { NotFoundError } from '../../core/_errors';
import { buildMeta, skipTake } from '../../core/http/pagination';
import { retryOutboxEvent } from '../../core/outbox/outbox';

type Row = Prisma.OutboxEventGetPayload<object>;

const toEvent = (row: Row): OutboxEvent => ({
  outbox_event_id: row.outbox_event_id,
  type: row.type,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  status: row.status,
  attempts: row.attempts,
  last_error: row.last_error,
  available_at: row.available_at.toISOString(),
  created_at: row.created_at.toISOString(),
  published_at: row.published_at?.toISOString() ?? null,
});

export async function listOutboxEvents(query: OutboxListQuery): Promise<Paginated<OutboxEvent>> {
  const where: Prisma.OutboxEventWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.outboxEvent.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { outbox_event_id: 'desc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.outboxEvent.count({ where }),
  ]);
  return { data: rows.map(toEvent), meta: buildMeta(query.page, query.page_size, total) };
}

/** Quantos eventos esperam ou falharam: o número que o painel destaca. */
export async function outboxSummary(): Promise<OutboxSummary> {
  const [pending, failed] = await Promise.all([
    prisma.outboxEvent.count({ where: { status: 'pending' } }),
    prisma.outboxEvent.count({ where: { status: 'failed' } }),
  ]);
  return { pending, failed };
}

export async function retryEvent(outboxEventId: string): Promise<OutboxEvent> {
  await retryOutboxEvent(outboxEventId);
  const row = await prisma.outboxEvent.findUnique({ where: { outbox_event_id: outboxEventId } });
  if (!row) throw new NotFoundError('Evento não encontrado.');
  return toEvent(row);
}
