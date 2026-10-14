import { type Prisma, prisma } from '@geekstore/db';
import type {
  Paginated,
  ReceiptDetail,
  ReceiptEvent,
  ReceiptImportBody,
  ReceiptItem,
  ReceiptItemUpdateBody,
  ReceiptListQuery,
  ReceiptManualBody,
  ReceiptRevertBody,
  ReceiptSummary,
  ReceiptUpdateBody,
  SkuSuggestion,
} from '@geekstore/shared';
import { v7 as uuidv7 } from 'uuid';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit/write-audit-log';
import { buildMeta, skipTake } from '../../core/http/pagination';
import { pickWithAi } from './ai-suggester';
import { NfeParseError, type ParsedNfe, parseNfe } from './nfe-parser';
import { suggestSkusByName } from './receipt-matching';
import { applyReceiptEntries } from './receipt-post';
import { revertReceiptEntries } from './receipt-revert';

const MAX_SUGGESTIONS = 5;
// Quantos candidatos por nome a IA recebe para escolher.
const AI_CANDIDATES = 15;

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
    xml_quantity: row.xml_quantity,
    unit_factor: row.unit_factor,
    quantity: row.quantity,
    unit_cost_cents: row.unit_cost_cents,
    total_cost_cents: row.total_cost_cents,
    discount_cents: row.discount_cents,
    ipi_cents: row.ipi_cents,
    icms_st_cents: row.icms_st_cents,
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
    charges: {
      freight_cents: row.freight_cents,
      insurance_cents: row.insurance_cents,
      other_cents: row.other_cents,
      discount_cents: row.discount_cents,
      ipi_cents: row.ipi_cents,
      icms_st_cents: row.icms_st_cents,
      include_ipi: row.include_ipi,
      include_icms_st: row.include_icms_st,
      apportion_basis: row.apportion_basis,
    },
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

/** Custo unitário em centavos a partir do total da linha e da quantidade em unidades nossas. */
function unitCostOf(totalCostCents: number, quantity: number): number {
  return Math.round(totalCostCents / quantity);
}

type Match = { skuId: string; method: 'mapping' | 'ean'; unitFactor: number };

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
          select: { supplier_code: true, sku_id: true, unit_factor: true },
        })
      : [],
    eans.length > 0
      ? tx.sku.findMany({
          where: { ean: { in: eans }, merged_into_sku_id: null },
          select: { sku_id: true, ean: true },
        })
      : [],
  ]);
  const mapped = new Map(mappings.map((row) => [row.supplier_code, row]));
  const eanOwners = new Map<string, string[]>();
  for (const sku of bySku) {
    if (sku.ean) eanOwners.set(sku.ean, [...(eanOwners.get(sku.ean) ?? []), sku.sku_id]);
  }
  return items.map((item) => {
    const viaMapping = item.supplierCode ? mapped.get(item.supplierCode) : undefined;
    if (viaMapping) {
      return {
        skuId: viaMapping.sku_id,
        method: 'mapping' as const,
        unitFactor: viaMapping.unit_factor,
      };
    }
    const owners = item.ean ? eanOwners.get(item.ean) : undefined;
    return owners?.length === 1
      ? { skuId: owners[0] as string, method: 'ean' as const, unitFactor: 1 }
      : null;
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
        freight_cents: parsed.charges.freightCents,
        insurance_cents: parsed.charges.insuranceCents,
        other_cents: parsed.charges.otherCents,
        discount_cents: parsed.charges.discountCents,
        ipi_cents: parsed.charges.ipiCents,
        icms_st_cents: parsed.charges.icmsStCents,
        location_id: locationId,
        xml: body.xml,
        created_by: actorId,
        items: {
          create: parsed.items.map((item, index) => {
            const unitFactor = matches[index]?.unitFactor ?? 1;
            const quantity = item.quantity * unitFactor;
            return {
              line: item.line,
              supplier_code: item.supplierCode,
              description: item.description,
              ean: item.ean,
              ncm: item.ncm,
              xml_quantity: item.quantity,
              unit_factor: unitFactor,
              quantity,
              unit_cost_cents: unitCostOf(item.totalCostCents, quantity),
              total_cost_cents: item.totalCostCents,
              discount_cents: item.discountCents,
              ipi_cents: item.ipiCents,
              icms_st_cents: item.icmsStCents,
              sku_id: matches[index]?.skuId ?? null,
              match_method: matches[index]?.method ?? null,
            };
          }),
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
        freight_cents: body.freight_cents ?? 0,
        insurance_cents: body.insurance_cents ?? 0,
        other_cents: body.other_cents ?? 0,
        location_id: locationId,
        created_by: actorId,
        items: {
          create: body.items.map((item, index) => ({
            line: index + 1,
            description: item.description,
            xml_quantity: item.quantity,
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

/** Encargos e política de custo da nota (frete, IPI incluído ou não, base do rateio). Só rascunho. */
export async function updateReceiptCharges(
  actorId: string,
  receiptId: string,
  body: ReceiptUpdateBody
): Promise<ReceiptDetail> {
  return prisma.$transaction(async (tx) => {
    const receipt = await loadReceipt(tx, receiptId);
    await assertDraft(receipt);
    await tx.purchaseReceipt.update({ where: { purchase_receipt_id: receiptId }, data: body });
    const before = Object.fromEntries(
      Object.keys(body).map((key) => [key, receipt[key as keyof typeof receipt]])
    );
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receiptId,
      action: 'update',
      before,
      after: body,
    });
    return toDetail(await loadReceipt(tx, receiptId));
  });
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
    // Fator novo refaz a quantidade; o total da linha (o que o fornecedor cobrou) não muda, então o
    // custo unitário acompanha, a menos que a pessoa informe o custo na mesma chamada.
    const unitFactor = body.unit_factor ?? item.unit_factor;
    const quantity =
      body.unit_factor !== undefined
        ? item.xml_quantity * unitFactor
        : (body.quantity ?? item.quantity);
    const unitCost =
      body.unit_cost_cents ??
      (body.unit_factor !== undefined
        ? unitCostOf(item.total_cost_cents, quantity)
        : item.unit_cost_cents);
    const repriced =
      body.unit_factor !== undefined ||
      body.quantity !== undefined ||
      body.unit_cost_cents !== undefined;
    await tx.purchaseReceiptItem.update({
      where: { purchase_receipt_item_id: itemId },
      data: {
        ...(body.sku_id !== undefined
          ? { sku_id: body.sku_id, match_method: body.sku_id ? ('manual' as const) : null }
          : {}),
        ...(body.ignored !== undefined ? { ignored: body.ignored } : {}),
        ...(body.unit_factor !== undefined ? { unit_factor: unitFactor } : {}),
        ...(repriced
          ? {
              quantity,
              unit_cost_cents: unitCost,
              // O total só muda quando o custo ou a quantidade são sobrescritos; trocar o fator
              // preserva o que o fornecedor cobrou.
              total_cost_cents:
                body.unit_factor !== undefined && body.unit_cost_cents === undefined
                  ? item.total_cost_cents
                  : quantity * unitCost,
            }
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
        unit_factor: item.unit_factor,
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

    const entered = await applyReceiptEntries(tx, receipt, actorId);
    await tx.purchaseReceiptEvent.create({
      data: { purchase_receipt_id: receiptId, type: 'posted', user_id: actorId },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receiptId,
      action: 'update',
      before: { status: 'draft' },
      after: {
        status: 'posted',
        items: entered,
      },
    });
    return toDetail(await loadReceipt(tx, receiptId));
  });
}

/**
 * Desprocessa uma nota lançada com motivo: a nota volta a rascunho (editável e relançável), o estoque
 * perde a entrada e o custo dos SKUs é refeito sem ela. Recusa se algum item já foi vendido ou reservado
 * (o saldo disponível não cobre a saída). O UPDATE condicional do status impede duas reversões juntas.
 */
export async function revertReceipt(
  actorId: string,
  receiptId: string,
  body: ReceiptRevertBody
): Promise<ReceiptDetail> {
  return prisma.$transaction(async (tx) => {
    await loadReceipt(tx, receiptId);
    const claimed = await tx.purchaseReceipt.updateMany({
      where: { purchase_receipt_id: receiptId, status: 'posted' },
      data: { status: 'draft', posted_at: null, posted_by: null },
    });
    if (claimed.count === 0) throw new ConflictError('Esta nota não está lançada.');

    const receipt = await tx.purchaseReceipt.findUniqueOrThrow({
      where: { purchase_receipt_id: receiptId },
      include: { items: { orderBy: { line: 'asc' } } },
    });
    const reverted = await revertReceiptEntries(tx, receipt, body.reason, actorId);
    await tx.purchaseReceiptItem.updateMany({
      where: { purchase_receipt_id: receiptId },
      data: { landed_unit_cost_e4: null },
    });
    await tx.purchaseReceiptEvent.create({
      data: {
        purchase_receipt_id: receiptId,
        type: 'reverted',
        reason: body.reason,
        user_id: actorId,
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'purchase_receipt',
      entityId: receiptId,
      action: 'update',
      before: { status: 'posted' },
      after: { status: 'draft', reason: body.reason, items: reverted },
    });
    return toDetail(await loadReceipt(tx, receiptId));
  });
}

export async function listReceiptEvents(receiptId: string): Promise<ReceiptEvent[]> {
  await loadReceipt(prisma, receiptId);
  const rows = await prisma.purchaseReceiptEvent.findMany({
    where: { purchase_receipt_id: receiptId },
    orderBy: [{ created_at: 'asc' }, { purchase_receipt_event_id: 'asc' }],
  });
  return rows.map((row) => ({
    event_id: row.purchase_receipt_event_id,
    type: row.type,
    reason: row.reason,
    user_id: row.user_id,
    created_at: row.created_at.toISOString(),
  }));
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
