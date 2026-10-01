import type { Prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { ConflictError } from '../../core/_errors';
import { asInt, asUuid, utcNow } from '../../core/db/sql';

/**
 * Primitivas atômicas do saldo (RNF-09). Todas recebem o cliente da transação do chamador: saldo,
 * movimentação e auditoria mudam juntos ou não mudam. Regras:
 *  - nunca ler o saldo e depois escrever: a condição vai no próprio UPDATE;
 *  - nunca deixar o disponível (`on_hand - reserved`) ficar negativo (o CHECK do banco é a rede
 *    de segurança, não a regra).
 */
export type LedgerTx = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw'>;

type Slot = { skuId: string; locationId: string };

/** Entrada: cria o saldo do par SKU/local se não existir, senão soma — um único statement. */
export async function addOnHand(tx: LedgerTx, slot: Slot, quantity: number): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO stock_level (stock_level_id, sku_id, location_id, on_hand, reserved, updated_at)
    VALUES (${asUuid(uuidv7())}, ${asUuid(slot.skuId)}, ${asUuid(slot.locationId)}, ${asInt(quantity)}, 0, ${utcNow})
    ON CONFLICT (sku_id, location_id)
    DO UPDATE SET on_hand = stock_level.on_hand + ${asInt(quantity)}, updated_at = ${utcNow}`;
}

/**
 * Saída/ajuste negativo: UPDATE condicional. Só baixa se sobrar `reserved` depois da baixa
 * (`on_hand - quantity >= reserved`). Linha afetada = 0 significa saldo insuficiente (ou par
 * inexistente) e nada mudou.
 */
export async function subtractOnHand(tx: LedgerTx, slot: Slot, quantity: number): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE stock_level
    SET on_hand = on_hand - ${asInt(quantity)}, updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND on_hand - ${asInt(quantity)} >= reserved`;

  if (affected === 0) {
    throw new ConflictError('Saldo disponível insuficiente para esta saída.');
  }
}

export type LockedLevel = { stock_level_id: string; on_hand: number; reserved: number };

/** Garante a existência da linha (no-op se já existe) e a devolve travada (`FOR UPDATE`). */
export async function lockLevel(tx: LedgerTx, slot: Slot): Promise<LockedLevel> {
  await tx.$executeRaw`
    INSERT INTO stock_level (stock_level_id, sku_id, location_id, on_hand, reserved, updated_at)
    VALUES (${asUuid(uuidv7())}, ${asUuid(slot.skuId)}, ${asUuid(slot.locationId)}, 0, 0, ${utcNow})
    ON CONFLICT (sku_id, location_id) DO NOTHING`;

  const rows = await tx.$queryRaw<LockedLevel[]>`
    SELECT stock_level_id, on_hand, reserved
    FROM stock_level
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
    FOR UPDATE`;

  const row = rows[0];
  if (!row) throw new ConflictError('Saldo não encontrado após a criação.');
  return { ...row, on_hand: Number(row.on_hand), reserved: Number(row.reserved) };
}

/**
 * Define o `on_hand` absoluto de uma linha já travada por `lockLevel`. O `WHERE` repete a regra
 * (`target >= reserved`), então mesmo que alguém chame sem a trava o saldo não fica inválido.
 */
export async function setOnHand(tx: LedgerTx, slot: Slot, target: number): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE stock_level
    SET on_hand = ${asInt(target)}, updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND ${asInt(target)} >= reserved`;

  if (affected === 0) {
    throw new ConflictError('O saldo físico não pode ficar abaixo da quantidade reservada.');
  }
}
