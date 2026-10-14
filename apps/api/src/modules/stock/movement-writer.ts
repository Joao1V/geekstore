import type { Prisma } from '@geekstore/db';

import type { LevelSnapshot } from './stock-ledger';

/**
 * Único ponto que grava `stock_movement`. Todo movimento carrega o saldo do par SKU/local logo
 * depois dele (`on_hand_after`/`reserved_after`), vindo do `RETURNING` da primitiva de saldo: o
 * extrato fica auditável e a conferência com `stock_level` (RF-EST-10) é uma consulta.
 * `movement-writer.guard.test.ts` falha se alguém gravar movimento por outro caminho.
 */
type MovementFields = Omit<
  Prisma.StockMovementUncheckedCreateInput,
  'on_hand_after' | 'reserved_after'
>;

/** Linha pronta para `createMany`: o saldo resultante é obrigatório no tipo. */
export type MovementRow = Omit<
  Prisma.StockMovementCreateManyInput,
  'on_hand_after' | 'reserved_after'
> & {
  on_hand_after: number;
  reserved_after: number;
};

export function movementRow(fields: MovementFields, after: LevelSnapshot): MovementRow {
  return { ...fields, on_hand_after: after.on_hand, reserved_after: after.reserved };
}

export function recordMovement(
  tx: Pick<Prisma.TransactionClient, 'stockMovement'>,
  fields: MovementFields,
  after: LevelSnapshot
) {
  return tx.stockMovement.create({ data: movementRow(fields, after) });
}

export async function recordMovements(
  tx: Pick<Prisma.TransactionClient, 'stockMovement'>,
  rows: readonly MovementRow[]
): Promise<void> {
  if (rows.length === 0) return;
  await tx.stockMovement.createMany({ data: [...rows] });
}
