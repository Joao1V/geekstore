import { type Prisma, prisma } from '@geekstore/db';
import type {
  Paginated,
  ReceiptDetail,
  ReceiptImportBody,
  ReceiptItem,
  ReceiptItemUpdateBody,
  ReceiptListQuery,
  ReceiptManualBody,
  ReceiptSummary,
  SkuSuggestion,
} from '@geekstore/shared';
import { v7 as uuidv7 } from 'uuid';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit/write-audit-log';
import { asUuid } from '../../core/db/sql';
import { buildMeta, skipTake } from '../../core/http/pagination';
import { addOnHand } from '../stock/stock-ledger';
import { pickWithAi } from './ai-suggester';
import { NfeParseError, type ParsedNfe, parseNfe } from './nfe-parser';
import { suggestSkusByName } from './receipt-matching';

const MAX_SUGGESTIONS = 5;
// Quantos candidatos por nome a IA recebe para escolher.
const AI_CANDIDATES = 15;
const POSTED_REASON = 'Entrada de nota de compra';
const REFERENCE_TYPE = 'purchase_receipt';

const itemInclude = {
  sku: { select: { sku_id: true, code: true, product: { select: { name: true } } } },
} satisfies Prisma.PurchaseReceiptItemInclude;

const receiptInclude = {
  supplier: true,
  items: { include: itemInclude, orderBy: { line: 'asc' } },
} satisfies Prisma.PurchaseReceiptInclude;

type ReceiptRow = Prisma.PurchaseReceiptGetPayload<{ include: typeof receiptInclude }>;
type ItemRow = ReceiptRow['items'][number];

function toItem(row: ItemRow): ReceiptItem {
  return {
    receipt_item_id: row.purchase_receipt_item_id,
    line: row.line,
    supplier_code: row.supplier_code,
    description: row.description,
    ean: row.ean,
    ncm: row.ncm,
    quantity: row.quantity,
    unit_cost_cents: row.unit_cost_cents,
    total_cost_cents: row.total_cost_cents,
    match_method: row.match_method,
    ignored: row.ignored,
    sku: row.sku
      ? { sku_id: row.sku.sku_id, code: row.sku.code, product_name: row.sku.product.name }
      : null,
  };
}

function toSummary(row: ReceiptRow): ReceiptSummary {
  return {
    receipt_id: row.purchase_receipt_id,
    number: row.number,
    series: row.series,
    access_key: row.access_key,
    issued_at: row.issued_at?.toISOString() ?? null,
    supplier: row.supplier
      ? {
          supplier_id: row.supplier.supplier_id,
          name: row.supplier.name,
          document: row.supplier.document,
        }
      : null,
    total_cents: row.total_cents,
    status: row.status,
    item_count: row.items.length,
    unmatched_count: row.items.filter((item) => !item.sku_id && !item.ignored).length,
    created_at: row.created_at.toISOString(),
    posted_at: row.posted_at?.toISOString() ?? null,
  };
}

function toDetail(row: ReceiptRow): ReceiptDetail {
  return {
    ...toSummary(row),
    location_id: row.location_id,
    notes: row.notes,
    items: row.items.map(toItem),
  };
}

async function defaultLocationId(tx: Prisma.TransactionClient): Promise<string> {
  const location = await tx.location.findFirst({
    where: { type: 'warehouse' },
    orderBy: { created_at: 'asc' },
    select: { location_id: true },
  });
  if (!location) throw new BadRequestError('Não há um depósito cadastrado para receber a nota.');
  return location.location_id;
}

async function assertLocation(tx: Prisma.TransactionClient, locationId: string): Promise<void> {
  if (!(await tx.location.findUnique({ where: { location_id: locationId } }))) {
    throw new NotFoundError('Local de estoque não encontrado.');
  }
}

async function loadReceipt(tx: Prisma.TransactionClient, receiptId: string): Promise<ReceiptRow> {
  const row = await tx.purchaseReceipt.findUnique({
    where: { purchase_receipt_id: receiptId },
    include: receiptInclude,
  });
  if (!row) throw new NotFoundError('Nota de entrada não encontrada.');
  return row;
}

async function assertDraft(row: { status: string }): Promise<void> {
  if (row.status !== 'draft')
    throw new ConflictError('Esta nota já foi lançada e não pode mais mudar.');
}

type Match = { skuId: string; method: 'mapping' | 'ean' };

/**
 * Liga cada item da nota a um SKU sem perguntar: primeiro pelo que já foi aprendido do fornecedor
 * (código do fornecedor -> SKU), depois pelo EAN. EAN que aparece em mais de um SKU não é confiável
 * (o cadastro tem EAN repetido): fica sem ligação para a pessoa escolher.
 */
async function autoMatch(
  tx: Prisma.TransactionClient,
  supplierId: string | null,
  items: readonly { supplierCode: string | null; ean: string | null }[]
): Promise<Match[] | null[]> {
  const codes = items.flatMap((item) => (item.supplierCode ? [item.supplierCode] : []));
  const eans = items.flatMap((item) => (item.ean ? [item.ean] : []));
  const [mappings, bySku] = await Promise.all([
    supplierId && codes.length > 0
      ? tx.supplierSku.findMany({
          where: { supplier_id: supplierId, supplier_code: { in: codes } },
          select: { supplier_code: true, sku_id: true },
        })
      : [],
    eans.length > 0
      ? tx.sku.findMany({
          where: { ean: { in: eans }, merged_into_sku_id: null },
          select: { sku_id: true, ean: true },
        })
      : [],
  ]);
  const mapped = new Map(mappings.map((row) => [row.supplier_code, row.sku_id]));
  const eanOwners = new Map<string, string[]>();
  for (const sku of bySku) {
    if (sku.ean) eanOwners.set(sku.ean, [...(eanOwners.get(sku.ean) ?? []), sku.sku_id]);
  }
  return items.map((item) => {
    const viaMapping = item.supplierCode ? mapped.get(item.supplierCode) : undefined;
    if (viaMapping) return { skuId: viaMapping, method: 'mapping' as const };
    const owners = item.ean ? eanOwners.get(item.ean) : undefined;
    return owners?.length === 1 ? { skuId: owners[0] as string, method: 'ean' as const } : null;
  }) as Match[] | null[];
}

async function upsertSupplier(
  tx: Prisma.TransactionClient,
  supplier: ParsedNfe['supplier']
): Promise<string> {
  if (supplier.document) {
    await tx.supplier.createMany({
      data: [{ supplier_id: uuidv7(), name: supplier.name, document: supplier.document }],
      skipDuplicates: true,
    });
    const found = await tx.supplier.findUniqueOrThrow({
      where: { document: supplier.document },
      select: { supplier_id: true },
    });
    return found.supplier_id;
  }
  const created = await tx.supplier.create({ data: { name: supplier.name } });
  return created.supplier_id;
}

/** Lê o XML da NF-e e cria o rascunho, já com os itens que dá para ligar sozinho. */
export async function importReceiptXml(
  actorId: string,
  body: ReceiptImportBody
): Promise<ReceiptDetail> {
  let parsed: ParsedNfe;
  try {
    parsed = parseNfe(body.xml);
  } catch (error) {
    if (error instanceof NfeParseError) throw new BadRequestError(error.message);
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseReceipt.findUnique({
      where: { access_key: parsed.accessKey },
      select: { purchase_receipt_id: true, status: true },
    });
    if (existing) {
      throw new ConflictError(
        `Esta nota já foi importada (${existing.status === 'posted' ? 'lançada' : 'em rascunho'}).`
      );
    }
    const locationId = body.location_id ?? (await defaultLocationId(tx));
    if (body.location_id) await assertLocation(tx, locationId);
    const supplierId = await upsertSupplier(tx, parsed.supplier);
    const matches = await autoMatch(tx, supplierId, parsed.items);

    const receipt = await tx.purchaseReceipt.create({
      data: {
        supplier_id: supplierId,
        number: parsed.number,
        series: parsed.series,
        access_key: parsed.accessKey,
        issued_at: parsed.issuedAt,
        total_cents: parsed.totalCents,
        location_id: locationId,
        xml: body.xml,
        created_by: actorId,
        items: {
          create: parsed.items.map((item, index) => ({
            line: item.line,
            supplier_code: item.supplierCode,
            description: item.description,
            ean: item.ean,
            ncm: item.ncm,
            quantity: item.quantity,
            unit_cost_cents: item.unitCostCents,
            total_cost_cents: item.totalCostCents,
            sku_id: matches[index]?.skuId ?? null,
            match_method: matches[index]?.method ?? null,
          })),
        },
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receipt.purchase_receipt_id,
      action: 'create',
      after: { number: parsed.number, access_key: parsed.accessKey, items: parsed.items.length },
    });
    return toDetail(await loadReceipt(tx, receipt.purchase_receipt_id));
  });
}

/** Nota sem XML: itens digitados (compra informal). Segue o mesmo caminho do rascunho. */
export async function createManualReceipt(
  actorId: string,
  body: ReceiptManualBody
): Promise<ReceiptDetail> {
  return prisma.$transaction(async (tx) => {
    const locationId = body.location_id ?? (await defaultLocationId(tx));
    if (body.location_id) await assertLocation(tx, locationId);
    const skuIds = [...new Set(body.items.flatMap((item) => (item.sku_id ? [item.sku_id] : [])))];
    if (
      skuIds.length > 0 &&
      (await tx.sku.count({ where: { sku_id: { in: skuIds } } })) !== skuIds.length
    ) {
      throw new NotFoundError('Algum SKU informado não existe.');
    }
    const supplier = body.supplier_name
      ? await tx.supplier.create({ data: { name: body.supplier_name } })
      : null;
    const receipt = await tx.purchaseReceipt.create({
      data: {
        supplier_id: supplier?.supplier_id ?? null,
        number: body.number ?? null,
        notes: body.notes ?? null,
        total_cents: body.items.reduce(
          (sum, item) => sum + item.quantity * item.unit_cost_cents,
          0
        ),
        location_id: locationId,
        created_by: actorId,
        items: {
          create: body.items.map((item, index) => ({
            line: index + 1,
            description: item.description,
            quantity: item.quantity,
            unit_cost_cents: item.unit_cost_cents,
            total_cost_cents: item.quantity * item.unit_cost_cents,
            sku_id: item.sku_id ?? null,
            match_method: item.sku_id ? ('manual' as const) : null,
          })),
        },
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receipt.purchase_receipt_id,
      action: 'create',
      after: { manual: true, items: body.items.length },
    });
    return toDetail(await loadReceipt(tx, receipt.purchase_receipt_id));
  });
}

export async function listReceipts(query: ReceiptListQuery): Promise<Paginated<ReceiptSummary>> {
  const term = query.q?.trim();
  const where: Prisma.PurchaseReceiptWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(term
      ? {
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { access_key: { contains: term } },
            { supplier: { name: { contains: term, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where,
      include: receiptInclude,
      orderBy: [{ created_at: 'desc' }, { purchase_receipt_id: 'desc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.purchaseReceipt.count({ where }),
  ]);
  return { data: rows.map(toSummary), meta: buildMeta(query.page, query.page_size, total) };
}

export async function getReceipt(receiptId: string): Promise<ReceiptDetail> {
  return toDetail(await loadReceipt(prisma, receiptId));
}

/** Liga o item a um SKU, ignora o item (frete, brinde) ou corrige quantidade e custo (caixa -> unidades). */
export async function updateReceiptItem(
  actorId: string,
  receiptId: string,
  itemId: string,
  body: ReceiptItemUpdateBody
): Promise<ReceiptDetail> {
  return prisma.$transaction(async (tx) => {
    const receipt = await loadReceipt(tx, receiptId);
    await assertDraft(receipt);
    const item = receipt.items.find((row) => row.purchase_receipt_item_id === itemId);
    if (!item) throw new NotFoundError('Item da nota não encontrado.');

    if (body.sku_id) {
      const sku = await tx.sku.findUnique({
        where: { sku_id: body.sku_id },
        select: { merged_into_sku_id: true },
      });
      if (!sku) throw new NotFoundError('SKU não encontrado.');
      if (sku.merged_into_sku_id)
        throw new ConflictError('Este SKU foi mesclado em outro; use o SKU de destino.');
    }
    const quantity = body.quantity ?? item.quantity;
    const unitCost = body.unit_cost_cents ?? item.unit_cost_cents;
    const repriced = body.quantity !== undefined || body.unit_cost_cents !== undefined;
    await tx.purchaseReceiptItem.update({
      where: { purchase_receipt_item_id: itemId },
      data: {
        ...(body.sku_id !== undefined
          ? { sku_id: body.sku_id, match_method: body.sku_id ? ('manual' as const) : null }
          : {}),
        ...(body.ignored !== undefined ? { ignored: body.ignored } : {}),
        ...(repriced
          ? { quantity, unit_cost_cents: unitCost, total_cost_cents: quantity * unitCost }
          : {}),
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receiptId,
      action: 'update',
      before: {
        line: item.line,
        sku_id: item.sku_id,
        ignored: item.ignored,
        quantity: item.quantity,
      },
      after: { line: item.line, ...body },
    });
    return toDetail(await loadReceipt(tx, receiptId));
  });
}

/** Sugestões por nome; com `useAi`, a escolha da IA (entre esses mesmos candidatos) vem na frente. */
export async function suggestForItem(
  receiptId: string,
  itemId: string,
  useAi = false
): Promise<SkuSuggestion[]> {
  const item = await prisma.purchaseReceiptItem.findFirst({
    where: { purchase_receipt_item_id: itemId, purchase_receipt_id: receiptId },
    select: { description: true, supplier_code: true, ean: true, ncm: true },
  });
  if (!item) throw new NotFoundError('Item da nota não encontrado.');
  const byName = await suggestSkusByName(item.description, useAi ? AI_CANDIDATES : MAX_SUGGESTIONS);
  if (!useAi) return byName;

  const pick = await pickWithAi(
    {
      description: item.description,
      supplierCode: item.supplier_code,
      ean: item.ean,
      ncm: item.ncm,
    },
    byName
  );
  const rest = byName.filter((candidate) => candidate.sku_id !== pick?.sku_id);
  return [...(pick ? [pick] : []), ...rest].slice(0, MAX_SUGGESTIONS);
}

/** Custo médio ponderado pelo saldo físico total do SKU (todos os locais). */
export function averageCost(
  currentCostCents: number | null,
  onHand: number,
  quantity: number,
  unitCostCents: number
): number {
  if (currentCostCents === null || onHand <= 0) return unitCostCents;
  return Math.round((currentCostCents * onHand + unitCostCents * quantity) / (onHand + quantity));
}

/**
 * Lança a nota: cada item ligado vira uma entrada no livro-razão, o custo médio do SKU é atualizado
 * e o código do fornecedor passa a apontar para o SKU. Tudo na mesma transação; o UPDATE condicional
 * do status impede lançar duas vezes (dois cliques, duas abas).
 */
export async function postReceipt(actorId: string, receiptId: string): Promise<ReceiptDetail> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.purchaseReceipt.updateMany({
      where: { purchase_receipt_id: receiptId, status: 'draft' },
      data: { status: 'posted', posted_at: new Date(), posted_by: actorId },
    });
    const receipt = await loadReceipt(tx, receiptId);
    if (claimed.count === 0) throw new ConflictError('Esta nota já foi lançada.');

    const pending = receipt.items.filter((item) => !item.sku_id && !item.ignored);
    if (pending.length > 0) {
      throw new BadRequestError(
        `Ligue a um SKU (ou ignore) os itens: ${pending.map((item) => `#${item.line}`).join(', ')}.`
      );
    }

    for (const item of receipt.items.filter((row) => row.sku_id && !row.ignored)) {
      const skuId = item.sku_id as string;
      // Trava o SKU: duas notas lançando o mesmo SKU ao mesmo tempo calculam o custo em fila.
      await tx.$queryRaw`SELECT sku_id FROM sku WHERE sku_id = ${asUuid(skuId)} FOR UPDATE`;
      const [sku, onHand] = await Promise.all([
        tx.sku.findUniqueOrThrow({ where: { sku_id: skuId }, select: { cost_cents: true } }),
        tx.stockLevel.aggregate({ where: { sku_id: skuId }, _sum: { on_hand: true } }),
      ]);
      await addOnHand(tx, { skuId, locationId: receipt.location_id }, item.quantity);
      await tx.stockMovement.create({
        data: {
          sku_id: skuId,
          location_id: receipt.location_id,
          type: 'inbound',
          quantity: item.quantity,
          reason: `${POSTED_REASON}${receipt.number ? ` ${receipt.number}` : ''}`.slice(0, 255),
          reference_type: REFERENCE_TYPE,
          reference_id: receiptId,
          user_id: actorId,
        },
      });
      await tx.sku.update({
        where: { sku_id: skuId },
        data: {
          cost_cents: averageCost(
            sku.cost_cents,
            onHand._sum.on_hand ?? 0,
            item.quantity,
            item.unit_cost_cents
          ),
        },
      });
      if (receipt.supplier_id && item.supplier_code) {
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
            sku_id: skuId,
          },
          update: { sku_id: skuId },
        });
      }
    }
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receiptId,
      action: 'update',
      before: { status: 'draft' },
      after: {
        status: 'posted',
        items: receipt.items.filter((i) => i.sku_id && !i.ignored).length,
      },
    });
    return toDetail(await loadReceipt(tx, receiptId));
  });
}

export async function deleteReceipt(actorId: string, receiptId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const receipt = await loadReceipt(tx, receiptId);
    await assertDraft(receipt);
    await tx.purchaseReceipt.delete({ where: { purchase_receipt_id: receiptId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receiptId,
      action: 'delete',
      before: { number: receipt.number, access_key: receipt.access_key },
    });
  });
}
