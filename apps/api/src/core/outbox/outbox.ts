import { Prisma, prisma } from '@geekstore/db';

import { asUuid } from '../db/sql';

type Tx = Prisma.TransactionClient;

// Tipos de evento de negócio publicados pelo outbox (D12). O nome é o contrato dos consumidores.
export const outboxEventTypes = [
  'order.created',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'stock.divergence_found',
] as const;
export type OutboxEventType = (typeof outboxEventTypes)[number];

export type OutboxInput = {
  type: OutboxEventType;
  entityType: 'order' | 'stock';
  entityId: string;
  payload?: Prisma.InputJsonValue;
};

/**
 * Grava o evento na MESMA transação da mudança de negócio. Se a transação desfaz, o evento some junto;
 * se ela confirma, o evento existe mesmo que o Redis esteja fora do ar (D12).
 */
export async function writeOutboxEvent(tx: Tx, input: OutboxInput): Promise<string> {
  const created = await tx.outboxEvent.create({
    data: {
      type: input.type,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: input.payload ?? {},
    },
    select: { outbox_event_id: true },
  });
  return created.outbox_event_id;
}

export type PublishedEvent = {
  outbox_event_id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  version: number;
  payload: Prisma.JsonValue;
};

/** Entrega um evento a quem o processa (a fila). Lança se não conseguir. */
export type EnqueueEvent = (event: PublishedEvent) => Promise<void>;

const BATCH_SIZE = 50;
const PUBLISH_TX_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 15 * 60_000;

/** Recuo exponencial entre tentativas: 5 s, 10 s, 20 s... até 15 min. */
export const backoffMs = (attempts: number): number =>
  Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));

type Row = {
  outbox_event_id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  version: number;
  payload: Prisma.JsonValue;
  attempts: number;
};

/**
 * Publicador: pega os eventos pendentes cujo horário já chegou e os entrega à fila. `FOR UPDATE SKIP
 * LOCKED` deixa várias instâncias publicarem sem pegar o mesmo evento. Falha na entrega agenda nova
 * tentativa com recuo; depois de {@link MAX_ATTEMPTS} o evento vira `failed` e aparece no painel, de
 * onde pode ser reprocessado. Devolve quantos foram publicados.
 */
export async function publishPendingEvents(
  enqueue: EnqueueEvent,
  options: { now?: Date; onlyIds?: readonly string[] } = {}
): Promise<number> {
  const now = options.now ?? new Date();
  const scope = options.onlyIds
    ? Prisma.sql`AND outbox_event_id IN (${Prisma.join(options.onlyIds.map(asUuid))})`
    : Prisma.empty;
  let published = 0;
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Row[]>`
      SELECT outbox_event_id::text AS outbox_event_id, type, entity_type, entity_id::text AS entity_id,
             version, payload, attempts
      FROM outbox_event
      WHERE status = 'pending' AND available_at <= ${now} ${scope}
      ORDER BY created_at
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED`;
      for (const row of rows) {
        try {
          await enqueue(row);
          await tx.outboxEvent.update({
            where: { outbox_event_id: row.outbox_event_id },
            data: { status: 'published', published_at: new Date(), last_error: null },
          });
          published += 1;
        } catch (error) {
          const attempts = row.attempts + 1;
          const exhausted = attempts >= MAX_ATTEMPTS;
          await tx.outboxEvent.update({
            where: { outbox_event_id: row.outbox_event_id },
            data: {
              attempts,
              status: exhausted ? 'failed' : 'pending',
              available_at: new Date(now.getTime() + backoffMs(attempts)),
              last_error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
            },
          });
        }
      }
    },
    { timeout: PUBLISH_TX_TIMEOUT_MS }
  );
  return published;
}

/** Reprocessar pelo painel: o evento volta a pendente e é publicado na próxima rodada. */
export async function retryOutboxEvent(outboxEventId: string): Promise<boolean> {
  const result = await prisma.outboxEvent.updateMany({
    where: { outbox_event_id: outboxEventId, status: { in: ['failed', 'published'] } },
    data: { status: 'pending', attempts: 0, available_at: new Date(), last_error: null },
  });
  return result.count > 0;
}
