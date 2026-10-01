import { prisma } from '@geekstore/db';
import type { stockDivergenceSchema } from '@geekstore/shared';
import type { z } from 'zod';

type Divergence = z.infer<typeof stockDivergenceSchema>;

// Evita uma resposta gigante se o livro-razão estiver muito corrompido; o alerta já é claro.
const MAX_DIVERGENCES = 1000;

type RawRow = {
  sku_id: string;
  location_id: string;
  level_on_hand: number | bigint | string;
  level_reserved: number | bigint | string;
  ledger_on_hand: number | bigint | string;
  ledger_reserved: number | bigint | string;
};

const toDivergence = (row: RawRow): Divergence => ({
  sku_id: row.sku_id,
  location_id: row.location_id,
  level_on_hand: Number(row.level_on_hand),
  ledger_on_hand: Number(row.ledger_on_hand),
  level_reserved: Number(row.level_reserved),
  ledger_reserved: Number(row.ledger_reserved),
});

/**
 * Conferência entre o saldo (`stock_level`) e a soma das movimentações (RF-EST-10).
 * `on_hand` = soma de inbound/outbound/adjustment/return; `reserved` = soma de reservation/release.
 * Também acusa movimentações de um par SKU/local que não tem linha de saldo.
 */
export async function reconcileStock(): Promise<{ checked: number; divergences: Divergence[] }> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT pairs.sku_id, pairs.location_id,
           COALESCE(sl.on_hand, 0) AS level_on_hand,
           COALESCE(sl.reserved, 0) AS level_reserved,
           COALESCE(m.ledger_on_hand, 0) AS ledger_on_hand,
           COALESCE(m.ledger_reserved, 0) AS ledger_reserved
    FROM (
      SELECT sku_id, location_id FROM stock_level
      UNION
      SELECT sku_id, location_id FROM stock_movement
    ) pairs
    LEFT JOIN stock_level sl ON sl.sku_id = pairs.sku_id AND sl.location_id = pairs.location_id
    LEFT JOIN (
      SELECT sku_id, location_id,
             SUM(CASE WHEN type IN ('inbound', 'outbound', 'adjustment', 'return')
                      THEN quantity ELSE 0 END) AS ledger_on_hand,
             SUM(CASE WHEN type IN ('reservation', 'release') THEN quantity ELSE 0 END)
               AS ledger_reserved
      FROM stock_movement
      GROUP BY sku_id, location_id
    ) m ON m.sku_id = pairs.sku_id AND m.location_id = pairs.location_id`;

  const divergences = rows
    .map(toDivergence)
    .filter(
      (row) =>
        row.level_on_hand !== row.ledger_on_hand || row.level_reserved !== row.ledger_reserved
    );

  return { checked: rows.length, divergences: divergences.slice(0, MAX_DIVERGENCES) };
}
