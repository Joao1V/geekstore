import type { Prisma } from '@geekstore/db';

import { BadRequestError } from '../../core/_errors';
import { asUuid } from '../../core/db/sql';
import { recordMovement } from '../stock/movement-writer';
import { addOnHand } from '../stock/stock-ledger';
import {
  type CostCharges,
  type CostItem,
  centsToE4,
  computeItemCosts,
  e4ToCents,
  type ItemCost,
  nextAverage,
} from './receipt-cost';

const POSTED_REASON = 'Entrada de nota de compra';
const REFERENCE_TYPE = 'purchase_receipt';
// Os custos em e4 cabem numa coluna INTEGER (int4).
const MAX_COST_E4 = 2_147_483_647;

type Tx = Prisma.TransactionClient;
export type PostableReceipt = Prisma.PurchaseReceiptGetPayload<{ include: { items: true } }>;
type PostableItem = PostableReceipt['items'][number];
type EnteringItem = PostableItem & { sku_id: string };

const isEntering = (item: PostableItem): item is EnteringItem => !!item.sku_id && !item.ignored;

/** Itens que viram entrada de estoque (ligados a um SKU e não ignorados), na ordem da nota. */
export const enteringItems = (receipt: PostableReceipt): EnteringItem[] =>
  receipt.items.filter(isEntering);

export function toCostItem(item: PostableItem): CostItem {
  return {
    quantity: item.quantity,
    grossCents: item.total_cost_cents,
    discountCents: item.discount_cents,
    ipiCents: item.ipi_cents,
    icmsStCents: item.icms_st_cents,
  };
}

export function toCostCharges(receipt: PostableReceipt): CostCharges {
  return {
    freightCents: receipt.freight_cents,
    insuranceCents: receipt.insurance_cents,
    otherCents: receipt.other_cents,
    discountCents: receipt.discount_cents,
    ipiCents: receipt.ipi_cents,
    icmsStCents: receipt.icms_st_cents,
    includeIpi: receipt.include_ipi,
    includeIcmsSt: receipt.include_icms_st,
    basis: receipt.apportion_basis,
  };
}

function assertFitsColumn(value: number, item: PostableItem): void {
  if (!Number.isSafeInteger(value) || value > MAX_COST_E4) {
    throw new BadRequestError(
      `O custo do item #${item.line} (${item.description}) é alto demais para ser registrado.`
    );
  }
}

type Averages = { cost: number | null; landed: number | null };

/**
 * Médias de que a próxima entrada parte: as da última entrada válida do SKU. Se alguém mexeu no
 * custo do SKU depois dela (o valor mostrado não bate mais com o histórico), vale o valor editado,
 * porque ele é o que a loja considera hoje. Sem histórico, parte do custo que o SKU já tinha.
 */
function startingAverages(
  sku: { cost_cents: number | null; landed_cost_cents: number | null },
  last: { average_cost_after_e4: number; average_landed_cost_after_e4: number } | null
): Averages {
  const fromCents = (cents: number | null) => (cents === null ? null : centsToE4(cents));
  const costIsUntouched = last && sku.cost_cents === e4ToCents(last.average_cost_after_e4);
  const landedIsUntouched =
    last &&
    (sku.landed_cost_cents ?? sku.cost_cents) === e4ToCents(last.average_landed_cost_after_e4);
  return {
    cost: costIsUntouched ? last.average_cost_after_e4 : fromCents(sku.cost_cents),
    landed: landedIsUntouched
      ? last.average_landed_cost_after_e4
      : fromCents(sku.landed_cost_cents ?? sku.cost_cents),
  };
}

async function enterItem(
  tx: Tx,
  receipt: PostableReceipt,
  item: EnteringItem,
  cost: ItemCost,
  actorId: string
): Promise<void> {
  const skuId = item.sku_id;
  assertFitsColumn(cost.landedUnitCostE4, item);
  assertFitsColumn(cost.unitCostE4, item);

  // Trava o SKU: duas notas lançando o mesmo SKU ao mesmo tempo calculam o custo em fila.
  await tx.$queryRaw`SELECT sku_id FROM sku WHERE sku_id = ${asUuid(skuId)} FOR UPDATE`;
  const [sku, onHand, last] = await Promise.all([
    tx.sku.findUniqueOrThrow({
      where: { sku_id: skuId },
      select: { cost_cents: true, landed_cost_cents: true },
    }),
    tx.stockLevel.aggregate({ where: { sku_id: skuId }, _sum: { on_hand: true } }),
    tx.skuCostEntry.findFirst({
      where: { sku_id: skuId, reverted_at: null },
      orderBy: [{ created_at: 'desc' }, { sku_cost_entry_id: 'desc' }],
    }),
  ]);
  const quantityBefore = onHand._sum.on_hand ?? 0;
  const start = startingAverages(sku, last);
  const average = nextAverage({
    previousAverageE4: start.cost,
    quantityBefore,
    quantityIn: item.quantity,
    unitCostE4: cost.unitCostE4,
  });
  const landedAverage = nextAverage({
    previousAverageE4: start.landed,
    quantityBefore,
    quantityIn: item.quantity,
    unitCostE4: cost.landedUnitCostE4,
  });

  await tx.skuCostEntry.create({
    data: {
      sku_id: skuId,
      purchase_receipt_item_id: item.purchase_receipt_item_id,
      occurred_on: receipt.issued_at ?? new Date(),
      quantity_in: item.quantity,
      quantity_before: quantityBefore,
      unit_cost_e4: cost.unitCostE4,
      landed_unit_cost_e4: cost.landedUnitCostE4,
      average_cost_before_e4: start.cost,
      average_landed_cost_before_e4: start.landed,
      average_cost_after_e4: average,
      average_landed_cost_after_e4: landedAverage,
    },
  });
  await tx.sku.update({
    where: { sku_id: skuId },
    data: { cost_cents: e4ToCents(average), landed_cost_cents: e4ToCents(landedAverage) },
  });
  await tx.purchaseReceiptItem.update({
    where: { purchase_receipt_item_id: item.purchase_receipt_item_id },
    data: { landed_unit_cost_e4: cost.landedUnitCostE4 },
  });

  const after = await addOnHand(tx, { skuId, locationId: receipt.location_id }, item.quantity);
  await recordMovement(
    tx,
    {
      sku_id: skuId,
      location_id: receipt.location_id,
      type: 'inbound',
      quantity: item.quantity,
      reason: `${POSTED_REASON}${receipt.number ? ` ${receipt.number}` : ''}`.slice(0, 255),
      reference_type: REFERENCE_TYPE,
      reference_id: receipt.purchase_receipt_id,
      user_id: actorId,
      unit_cost_e4: cost.landedUnitCostE4,
    },
    after
  );
}

/** O código do fornecedor passa a apontar para o SKU, com o fator de conversão que valeu nesta nota. */
async function rememberSupplierCode(
  tx: Tx,
  receipt: PostableReceipt,
  item: EnteringItem
): Promise<void> {
  if (!receipt.supplier_id || !item.supplier_code) return;
  await tx.supplierSku.upsert({
    where: {
      supplier_id_supplier_code: {
        supplier_id: receipt.supplier_id,
        supplier_code: item.supplier_code,
      },
    },
    create: {
      supplier_id: receipt.supplier_id,
      supplier_code: item.supplier_code,
      sku_id: item.sku_id,
      unit_factor: item.unit_factor,
    },
    update: { sku_id: item.sku_id, unit_factor: item.unit_factor },
  });
}

/**
 * Lançamento da nota, dentro da transação do chamador: rateia os encargos, e por item grava o
 * histórico de custo, atualiza o custo do SKU e dá a entrada no livro-razão. O custo é calculado
 * antes de o estoque subir (a média pesa pelo saldo de antes).
 */
export async function applyReceiptEntries(
  tx: Tx,
  receipt: PostableReceipt,
  actorId: string
): Promise<number> {
  const entering = enteringItems(receipt);
  const costs = computeItemCosts(entering.map(toCostItem), toCostCharges(receipt));
  // Ordem estável de SKU entre notas concorrentes evita deadlock nas travas; a ordem da nota
  // desempata o mesmo SKU em duas linhas.
  const queue = entering
    .map((item, index) => ({ item, cost: costs[index] as ItemCost }))
    .sort((a, b) => a.item.sku_id.localeCompare(b.item.sku_id) || a.item.line - b.item.line);

  for (const { item, cost } of queue) {
    await enterItem(tx, receipt, item, cost, actorId);
    await rememberSupplierCode(tx, receipt, item);
  }
  return queue.length;
}
