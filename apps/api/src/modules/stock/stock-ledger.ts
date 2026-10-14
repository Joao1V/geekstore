import type { Prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { ConflictError } from '../../core/_errors';
import { asInt, asUuid, utcNow } from '../../core/db/sql';

/**
 * Primitivas atômicas do saldo (RNF-09). Todas recebem o cliente da transação do chamador: saldo,
 * movimentação e auditoria mudam juntos ou não mudam. Regras:
 *  - nunca ler o saldo e depois escrever: a condição vai no próprio UPDATE;
 *  - nunca deixar o disponível (`on_hand - reserved`) ficar negativo (o CHECK do banco é a rede
 *    de segurança, não a regra);
 *  - cada primitiva devolve o saldo resultante (`RETURNING`), que o chamador grava no movimento
 *    por `movement-writer`.
 */
export type LedgerTx = Pick<Prisma.TransactionClient, '$executeRaw' | '$queryRaw'>;

type Slot = { skuId: string; locationId: string };

/** Saldo do par SKU/local logo depois da operação: vai para o movimento (`on_hand_after`). */
export type LevelSnapshot = { on_hand: number; reserved: number };

/** Primeira linha do `RETURNING` (colunas `int4` já chegam como número) ou `null` se nada mudou. */
function firstSnapshot(rows: LevelSnapshot[]): LevelSnapshot | null {
  const row = rows[0];
  return row ? { on_hand: Number(row.on_hand), reserved: Number(row.reserved) } : null;
}

/** Entrada: cria o saldo do par SKU/local se não existir, senão soma — um único statement. */
export async function addOnHand(
  tx: LedgerTx,
  slot: Slot,
  quantity: number
): Promise<LevelSnapshot> {
  const rows = await tx.$queryRaw<LevelSnapshot[]>`
    INSERT INTO stock_level (stock_level_id, sku_id, location_id, on_hand, reserved, updated_at)
    VALUES (${asUuid(uuidv7())}, ${asUuid(slot.skuId)}, ${asUuid(slot.locationId)}, ${asInt(quantity)}, 0, ${utcNow})
    ON CONFLICT (sku_id, location_id)
    DO UPDATE SET on_hand = stock_level.on_hand + ${asInt(quantity)}, updated_at = ${utcNow}
    RETURNING on_hand, reserved`;

  const snapshot = firstSnapshot(rows);
  if (!snapshot) throw new ConflictError('Saldo não encontrado após a entrada.');
  return snapshot;
}

/**
 * Saída/ajuste negativo: UPDATE condicional. Só baixa se sobrar `reserved` depois da baixa
 * (`on_hand - quantity >= reserved`). Nenhuma linha devolvida significa saldo insuficiente (ou par
 * inexistente) e nada mudou.
 */
export async function subtractOnHand(
  tx: LedgerTx,
  slot: Slot,
  quantity: number
): Promise<LevelSnapshot> {
  const rows = await tx.$queryRaw<LevelSnapshot[]>`
    UPDATE stock_level
    SET on_hand = on_hand - ${asInt(quantity)}, updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND on_hand - ${asInt(quantity)} >= reserved
    RETURNING on_hand, reserved`;

  const snapshot = firstSnapshot(rows);
  if (!snapshot) throw new ConflictError('Saldo disponível insuficiente para esta saída.');
  return snapshot;
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
export async function setOnHand(tx: LedgerTx, slot: Slot, target: number): Promise<LevelSnapshot> {
  const rows = await tx.$queryRaw<LevelSnapshot[]>`
    UPDATE stock_level
    SET on_hand = ${asInt(target)}, updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND ${asInt(target)} >= reserved
    RETURNING on_hand, reserved`;

  const snapshot = firstSnapshot(rows);
  if (!snapshot) {
    throw new ConflictError('O saldo físico não pode ficar abaixo da quantidade reservada.');
  }
  return snapshot;
}

/**
 * Reserva: o disponível (`on_hand - reserved`) tem que cobrir a quantidade, conferido no próprio
 * UPDATE. Nenhuma linha devolvida = sem saldo (ou par inexistente) e nada mudou.
 */
export async function reserveOnHand(
  tx: LedgerTx,
  slot: Slot,
  quantity: number
): Promise<LevelSnapshot> {
  const rows = await tx.$queryRaw<LevelSnapshot[]>`
    UPDATE stock_level
    SET reserved = reserved + ${asInt(quantity)}, updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND on_hand - reserved >= ${asInt(quantity)}
    RETURNING on_hand, reserved`;

  const snapshot = firstSnapshot(rows);
  if (!snapshot) throw new ConflictError('Saldo disponível insuficiente para reservar.');
  return snapshot;
}

/** Libera uma reserva (pedido cancelado ou expirado): `reserved` desce, `on_hand` não muda. */
export async function releaseReserved(
  tx: LedgerTx,
  slot: Slot,
  quantity: number
): Promise<LevelSnapshot> {
  const rows = await tx.$queryRaw<LevelSnapshot[]>`
    UPDATE stock_level
    SET reserved = reserved - ${asInt(quantity)}, updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND reserved >= ${asInt(quantity)}
    RETURNING on_hand, reserved`;

  const snapshot = firstSnapshot(rows);
  if (!snapshot) throw new ConflictError('A reserva a liberar não existe mais.');
  return snapshot;
}

/** Expedição: a unidade sai de verdade (`on_hand` e `reserved` descem juntos). */
export async function consumeReserved(
  tx: LedgerTx,
  slot: Slot,
  quantity: number
): Promise<LevelSnapshot> {
  const rows = await tx.$queryRaw<LevelSnapshot[]>`
    UPDATE stock_level
    SET on_hand = on_hand - ${asInt(quantity)}, reserved = reserved - ${asInt(quantity)},
        updated_at = ${utcNow}
    WHERE sku_id = ${asUuid(slot.skuId)} AND location_id = ${asUuid(slot.locationId)}
      AND reserved >= ${asInt(quantity)} AND on_hand >= ${asInt(quantity)}
    RETURNING on_hand, reserved`;

  const snapshot = firstSnapshot(rows);
  if (!snapshot) throw new ConflictError('Não há reserva suficiente para expedir.');
  return snapshot;
}
