import { prisma } from '@geekstore/db';

import { writeOutboxEvent } from '../../core/outbox/outbox';

export type StockDivergence = {
  sku_id: string;
  code: string;
  field: 'on_hand' | 'reserved';
  expected: number;
  actual: number;
};

type Row = {
  sku_id: string;
  code: string;
  on_hand: number;
  reserved: number;
  on_hand_after: number;
  reserved_after: number;
};

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Confere o saldo guardado (`stock_level`) contra o saldo gravado no ÚLTIMO movimento de cada par
 * SKU/local (RF-EST-10). Em dia, os dois são iguais; a diferença revela escrita fora do livro-razão
 * ou movimento perdido. Movimentos antigos, sem saldo gravado, ficam de fora.
 */
export async function findStockDivergences(): Promise<StockDivergence[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT l.sku_id::text AS sku_id, k.code, l.on_hand, l.reserved,
           m.on_hand_after, m.reserved_after
    FROM stock_level l
    JOIN sku k ON k.sku_id = l.sku_id
    JOIN LATERAL (
      SELECT on_hand_after, reserved_after
      FROM stock_movement
      WHERE sku_id = l.sku_id AND location_id = l.location_id
      ORDER BY created_at DESC, stock_movement_id DESC
      LIMIT 1
    ) m ON m.on_hand_after IS NOT NULL AND m.reserved_after IS NOT NULL
    WHERE l.on_hand <> m.on_hand_after OR l.reserved <> m.reserved_after
    ORDER BY k.code`;
  return rows.flatMap((row) => [
    ...(row.on_hand === row.on_hand_after
      ? []
      : [
          {
            sku_id: row.sku_id,
            code: row.code,
            field: 'on_hand' as const,
            expected: row.on_hand_after,
            actual: row.on_hand,
          },
        ]),
    ...(row.reserved === row.reserved_after
      ? []
      : [
          {
            sku_id: row.sku_id,
            code: row.code,
            field: 'reserved' as const,
            expected: row.reserved_after,
            actual: row.reserved,
          },
        ]),
  ]);
}

/**
 * Roda a conferência e, se houver divergência, avisa pelo outbox (e-mail para a operação). Para não
 * repetir o mesmo alerta a cada rodada, só avisa de novo depois de 24 h. Devolve as divergências.
 */
export async function reconcileStock(now = new Date()): Promise<StockDivergence[]> {
  const divergences = await findStockDivergences();
  if (divergences.length === 0) return divergences;

  const recent = await prisma.outboxEvent.findFirst({
    where: {
      type: 'stock.divergence_found',
      created_at: { gt: new Date(now.getTime() - ALERT_COOLDOWN_MS) },
    },
    select: { outbox_event_id: true },
  });
  if (recent) return divergences;

  await prisma.$transaction((tx) =>
    writeOutboxEvent(tx, {
      type: 'stock.divergence_found',
      entityType: 'stock',
      // Sem entidade própria: o primeiro SKU divergente identifica o alerta.
      entityId: divergences[0]?.sku_id ?? '',
      payload: { rows: divergences.slice(0, 100) },
    })
  );
  return divergences;
}
