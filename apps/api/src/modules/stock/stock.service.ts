import { type Prisma, prisma } from '@geekstore/db';
import type {
  Location,
  Paginated,
  StockBulkBody,
  StockLevel,
  StockLevelListQuery,
  StockMovement,
  StockMovementBody,
  StockMovementListQuery,
} from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { type AuditEntry, writeAuditLog, writeAuditLogs } from '../../core/audit';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';
import { toLocation, toStockLevel, toStockMovement } from './stock.mappers';
import { movementDelta } from './stock-delta';
import { addOnHand, lockLevel, setOnHand, subtractOnHand } from './stock-ledger';

const BULK_TX_TIMEOUT_MS = 30_000;
const LEVEL_SORT_FIELDS = ['updated_at', 'on_hand', 'reserved'] as const;

export async function listLocations(): Promise<Location[]> {
  const rows = await prisma.location.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  return rows.map(toLocation);
}

export async function listLevels(query: StockLevelListQuery): Promise<Paginated<StockLevel>> {
  const { field, direction } = parseSort(query.sort, LEVEL_SORT_FIELDS, {
    field: 'updated_at',
    direction: 'desc',
  });
  const where: Prisma.StockLevelWhereInput = {
    ...(query.sku_id ? { sku_id: query.sku_id } : {}),
    ...(query.location_id ? { location_id: query.location_id } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.stockLevel.findMany({
      where,
      orderBy: [{ [field]: direction }, { stock_level_id: 'asc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.stockLevel.count({ where }),
  ]);
  return { data: rows.map(toStockLevel), meta: buildMeta(query.page, query.page_size, total) };
}

export async function listMovements(
  query: StockMovementListQuery
): Promise<Paginated<StockMovement>> {
  const where: Prisma.StockMovementWhereInput = {
    ...(query.sku_id ? { sku_id: query.sku_id } : {}),
    ...(query.location_id ? { location_id: query.location_id } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      // uuid v7 é cronológico: o id desempata movimentações no mesmo milissegundo.
      orderBy: [{ created_at: 'desc' }, { stock_movement_id: 'desc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return { data: rows.map(toStockMovement), meta: buildMeta(query.page, query.page_size, total) };
}

async function assertSlotsExist(
  tx: Prisma.TransactionClient,
  skuIds: readonly string[],
  locationIds: readonly string[]
): Promise<void> {
  const uniqueSkus = [...new Set(skuIds)];
  const uniqueLocations = [...new Set(locationIds)];
  const [skuCount, locationCount] = await Promise.all([
    tx.sku.count({ where: { sku_id: { in: uniqueSkus } } }),
    tx.location.count({ where: { location_id: { in: uniqueLocations } } }),
  ]);
  if (skuCount !== uniqueSkus.length) throw new NotFoundError('SKU não encontrado.');
  if (locationCount !== uniqueLocations.length) throw new NotFoundError('Local não encontrado.');
}

/** Movimentação manual (RF-EST-02): saldo + movimentação + auditoria na mesma transação. */
export async function createMovement(
  actorId: string,
  body: StockMovementBody
): Promise<{ movement: StockMovement; level: StockLevel }> {
  const delta = movementDelta(body.type, body.quantity);
  const slot = { skuId: body.sku_id, locationId: body.location_id };

  return prisma.$transaction(async (tx) => {
    await assertSlotsExist(tx, [body.sku_id], [body.location_id]);

    if (delta > 0) await addOnHand(tx, slot, delta);
    else await subtractOnHand(tx, slot, -delta);

    const level = await tx.stockLevel.findUniqueOrThrow({
      where: { sku_id_location_id: { sku_id: body.sku_id, location_id: body.location_id } },
    });
    const movement = await tx.stockMovement.create({
      data: {
        sku_id: body.sku_id,
        location_id: body.location_id,
        type: body.type,
        quantity: delta,
        reason: body.reason,
        user_id: actorId,
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'stock_level',
      entityId: level.stock_level_id,
      action: 'update',
      before: { on_hand: level.on_hand - delta, reserved: level.reserved },
      after: { on_hand: level.on_hand, reserved: level.reserved },
    });

    return { movement: toStockMovement(movement), level: toStockLevel(level) };
  });
}

function sortedBySlot<T extends { sku_id: string; location_id: string }>(items: readonly T[]): T[] {
  // Ordem estável de travas entre lotes concorrentes evita deadlock.
  return [...items].sort((a, b) =>
    `${a.sku_id}:${a.location_id}`.localeCompare(`${b.sku_id}:${b.location_id}`)
  );
}

function assertNoDuplicateSlots(items: readonly { sku_id: string; location_id: string }[]) {
  const keys = new Set(items.map((item) => `${item.sku_id}:${item.location_id}`));
  if (keys.size !== items.length) {
    throw new BadRequestError('O lote tem o mesmo SKU/local mais de uma vez.');
  }
}

/**
 * Edição em lote da grade: define o `on_hand` absoluto de cada par SKU/local. Cada mudança vira
 * uma movimentação `adjustment` com o delta. Tudo ou nada, numa transação. Devolve quantas linhas
 * realmente mudaram (linhas já no valor pedido são ignoradas).
 */
export async function bulkSetOnHand(actorId: string, body: StockBulkBody): Promise<number> {
  assertNoDuplicateSlots(body.items);
  const items = sortedBySlot(body.items);

  return prisma.$transaction(
    async (tx) => {
      await assertSlotsExist(
        tx,
        items.map((item) => item.sku_id),
        items.map((item) => item.location_id)
      );

      const movements: Prisma.StockMovementCreateManyInput[] = [];
      const audits: AuditEntry[] = [];

      for (const item of items) {
        const slot = { skuId: item.sku_id, locationId: item.location_id };
        const locked = await lockLevel(tx, slot);
        const delta = item.on_hand - locked.on_hand;
        if (delta === 0) continue;

        await setOnHand(tx, slot, item.on_hand);
        movements.push({
          sku_id: item.sku_id,
          location_id: item.location_id,
          type: 'adjustment',
          quantity: delta,
          reason: body.reason,
          user_id: actorId,
        });
        audits.push({
          userId: actorId,
          entity: 'stock_level',
          entityId: locked.stock_level_id,
          action: 'update',
          before: { on_hand: locked.on_hand, reserved: locked.reserved },
          after: { on_hand: item.on_hand, reserved: locked.reserved },
        });
      }

      await tx.stockMovement.createMany({ data: movements });
      await writeAuditLogs(tx, audits);
      return movements.length;
    },
    { timeout: BULK_TX_TIMEOUT_MS }
  );
}
