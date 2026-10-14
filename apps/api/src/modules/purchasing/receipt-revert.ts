import type { Prisma } from '@geekstore/db';

import { ConflictError } from '../../core/_errors';
import { asUuid } from '../../core/db/sql';
import { recordMovement } from '../stock/movement-writer';
import { subtractOnHand } from '../stock/stock-ledger';
import { type CostEntry, e4ToCents, replayChain } from './receipt-cost';
import { enteringItems, type PostableReceipt } from './receipt-post';

const REVERSAL_REFERENCE = 'purchase_receipt_reversal';
const MAX_REASON_IN_MOVEMENT = 255;

type Tx = Prisma.TransactionClient;
type EnteringItem = ReturnType<typeof enteringItems>[number];

/** Tira a entrada do estoque; sem saldo disponível para cobrir, recusa dizendo qual SKU e quanto falta. */
async function takeStockOut(
  tx: Tx,
  receipt: PostableReceipt,
  item: EnteringItem,
  reason: string,
  actorId: string
): Promise<void> {
  const slot = { skuId: item.sku_id, locationId: receipt.location_id };
  let after: Awaited<ReturnType<typeof subtractOnHand>>;
  try {
    after = await subtractOnHand(tx, slot, item.quantity);
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    const [sku, level] = await Promise.all([
      tx.sku.findUnique({ where: { sku_id: item.sku_id }, select: { code: true } }),
      tx.stockLevel.findUnique({
        where: { sku_id_location_id: { sku_id: item.sku_id, location_id: receipt.location_id } },
      }),
    ]);
    const available = level ? level.on_hand - level.reserved : 0;
    throw new ConflictError(
      `Não dá para desprocessar: ${sku?.code ?? item.description} tem ${available} disponível(is) e a nota deu entrada de ${item.quantity}.`
    );
  }
  await recordMovement(
    tx,
    {
      sku_id: item.sku_id,
      location_id: receipt.location_id,
      type: 'outbound',
      quantity: -item.quantity,
      reason:
        `Desprocessamento da nota${receipt.number ? ` ${receipt.number}` : ''}: ${reason}`.slice(
          0,
          MAX_REASON_IN_MOVEMENT
        ),
      reference_type: REVERSAL_REFERENCE,
      reference_id: receipt.purchase_receipt_id,
      user_id: actorId,
      unit_cost_e4: item.landed_unit_cost_e4,
    },
    after
  );
}

/**
 * Marca como revertidas as entradas de custo desta nota e refaz a cadeia do SKU sem elas. Só o
 * `average_*_after_e4` é regravado: `quantity_before` fica como foi (o replay sempre parte do original,
 * então refazer a cadeia de novo, depois de outra reversão, dá o mesmo resultado). O custo mostrado no
 * SKU só muda se ninguém o tinha editado à mão depois da última entrada.
 */
async function rewindCost(tx: Tx, skuId: string, receiptItemIds: readonly string[]): Promise<void> {
  const [sku, rows] = await Promise.all([
    tx.sku.findUniqueOrThrow({
      where: { sku_id: skuId },
      select: { cost_cents: true, landed_cost_cents: true },
    }),
    tx.skuCostEntry.findMany({
      where: { sku_id: skuId },
      orderBy: [{ created_at: 'asc' }, { sku_cost_entry_id: 'asc' }],
    }),
  ]);
  const lastValid = [...rows].reverse().find((row) => !row.reverted_at);
  const touched = rows.filter((row) => receiptItemIds.includes(row.purchase_receipt_item_id));
  if (touched.every((row) => row.reverted_at)) return;

  const costUntouched = !lastValid || sku.cost_cents === e4ToCents(lastValid.average_cost_after_e4);
  const landedUntouched =
    !lastValid ||
    (sku.landed_cost_cents ?? sku.cost_cents) === e4ToCents(lastValid.average_landed_cost_after_e4);

  const now = new Date();
  const revertedIds = new Set(
    touched.filter((row) => !row.reverted_at).map((row) => row.sku_cost_entry_id)
  );
  await tx.skuCostEntry.updateMany({
    where: { sku_cost_entry_id: { in: [...revertedIds] } },
    data: { reverted_at: now },
  });

  const chain: CostEntry[] = rows.map((row) => ({
    id: row.sku_cost_entry_id,
    quantityBefore: row.quantity_before,
    quantityIn: row.quantity_in,
    unitCostE4: row.unit_cost_e4,
    landedUnitCostE4: row.landed_unit_cost_e4,
    averageBeforeE4: row.average_cost_before_e4,
    landedAverageBeforeE4: row.average_landed_cost_before_e4,
    reverted: Boolean(row.reverted_at) || revertedIds.has(row.sku_cost_entry_id),
  }));
  const replayed = replayChain(chain);

  const byId = new Map(rows.map((row) => [row.sku_cost_entry_id, row]));
  for (const entry of replayed.entries) {
    const current = byId.get(entry.id);
    if (
      current?.average_cost_after_e4 === entry.averageAfterE4 &&
      current.average_landed_cost_after_e4 === entry.landedAverageAfterE4
    ) {
      continue;
    }
    await tx.skuCostEntry.update({
      where: { sku_cost_entry_id: entry.id },
      data: {
        average_cost_after_e4: entry.averageAfterE4,
        average_landed_cost_after_e4: entry.landedAverageAfterE4,
      },
    });
  }

  await tx.sku.update({
    where: { sku_id: skuId },
    data: {
      ...(costUntouched
        ? { cost_cents: replayed.averageE4 === null ? null : e4ToCents(replayed.averageE4) }
        : {}),
      ...(landedUntouched
        ? {
            landed_cost_cents:
              replayed.landedAverageE4 === null ? null : e4ToCents(replayed.landedAverageE4),
          }
        : {}),
    },
  });
}

/**
 * Desprocessa a nota (dentro da transação do chamador): tira do estoque o que ela deu de entrada e
 * refaz o custo dos SKUs sem ela. Tudo ou nada: sem saldo disponível em algum item, nada muda.
 * Devolve quantos itens foram revertidos.
 */
export async function revertReceiptEntries(
  tx: Tx,
  receipt: PostableReceipt,
  reason: string,
  actorId: string
): Promise<number> {
  const bySku = new Map<string, EnteringItem[]>();
  for (const item of enteringItems(receipt)) {
    bySku.set(item.sku_id, [...(bySku.get(item.sku_id) ?? []), item]);
  }
  // Ordem estável de SKU entre operações concorrentes evita deadlock nas travas.
  const skuIds = [...bySku.keys()].sort((a, b) => a.localeCompare(b));

  let reverted = 0;
  for (const skuId of skuIds) {
    await tx.$queryRaw`SELECT sku_id FROM sku WHERE sku_id = ${asUuid(skuId)} FOR UPDATE`;
    const items = [...(bySku.get(skuId) ?? [])].sort((a, b) => a.line - b.line);
    for (const item of items) {
      await takeStockOut(tx, receipt, item, reason, actorId);
      reverted += 1;
    }
    await rewindCost(
      tx,
      skuId,
      items.map((item) => item.purchase_receipt_item_id)
    );
  }
  return reverted;
}
