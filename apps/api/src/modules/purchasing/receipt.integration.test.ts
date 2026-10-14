import { randomInt } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { receiptItemUpdateBodySchema } from '@geekstore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { createMovement } from '../stock/stock.service';
import {
  createManualReceipt,
  deleteReceipt,
  importReceiptXml,
  postReceipt,
  revertReceipt,
  suggestForItem,
  updateReceiptCharges,
  updateReceiptItem,
} from './receipt.service';

const digits = (length: number) => Array.from({ length }, () => randomInt(0, 10)).join('');

/** GTIN-13 com dígito verificador correto: o parser descarta EAN inválido. */
function gtin13(): string {
  const base = `789${digits(9)}`;
  const sum = [...base].reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return `${base}${(10 - (sum % 10)) % 10}`;
}

type Line = { code: string; ean: string | null; name: string; qty: number; total: string };

const xml = (key: string, cnpj: string, lines: Line[]) => `<?xml version="1.0"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${key}">
<ide><nNF>${randomInt(1, 99999)}</nNF><serie>1</serie><dhEmi>2026-10-01T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>${cnpj}</CNPJ><xNome>Fornecedor Teste</xNome></emit>
${lines
  .map(
    (
      line,
      i
    ) => `<det nItem="${i + 1}"><prod><cProd>${line.code}</cProd><cEAN>${line.ean ?? 'SEM GTIN'}</cEAN>
<xProd>${line.name}</xProd><NCM>95030099</NCM><qCom>${line.qty}.0000</qCom><vProd>${line.total}</vProd></prod></det>`
  )
  .join('')}
<total><ICMSTot><vNF>999.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

describe('purchase receipts (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;
  const cnpj = digits(14);
  const eanA = gtin13();
  const eanDup = gtin13();
  let skuA = '';
  let skuB = '';
  let skuC = '';
  let skuD = '';
  let skuE = '';
  let skuF = '';
  let skuG = '';
  const supplierIds = new Set<string>();

  const importLines = async (lines: Line[], key = digits(44)) => {
    const receipt = await importReceiptXml(fx.userId, { xml: xml(key, cnpj, lines) });
    if (receipt.supplier) supplierIds.add(receipt.supplier.supplier_id);
    return receipt;
  };

  const levelOf = async (skuId: string) =>
    (await prisma.stockLevel.findFirst({ where: { sku_id: skuId, location_id: fx.locationId } }))
      ?.on_hand ?? 0;

  beforeAll(async () => {
    fx = await createCatalogFixture();
    const make = (suffix: string, ean: string | null) =>
      prisma.sku.create({
        data: { code: `${fx.skuCode}-${suffix}`, ean, product_id: fx.productId },
      });
    skuA = (await make('A', eanA)).sku_id;
    skuB = (await make('B', null)).sku_id;
    skuC = (await make('C', null)).sku_id;
    skuD = (await make('D', null)).sku_id;
    skuE = (await make('E', null)).sku_id;
    skuF = (await make('F', null)).sku_id;
    skuG = (await make('G', null)).sku_id;
    await make('D1', eanDup);
    await make('D2', eanDup);
  });

  afterAll(async () => {
    await prisma.skuCostEntry.deleteMany({ where: { sku: { product_id: fx.productId } } });
    await prisma.purchaseReceipt.deleteMany({ where: { supplier_id: { in: [...supplierIds] } } });
    await prisma.purchaseReceipt.deleteMany({ where: { created_by: fx.userId } });
    await prisma.supplierSku.deleteMany({ where: { supplier_id: { in: [...supplierIds] } } });
    await fx.cleanup();
    await prisma.supplier.deleteMany({ where: { supplier_id: { in: [...supplierIds] } } });
    await prisma.$disconnect();
  });

  it('imports an NF-e as a draft and links by EAN, leaving the rest and the repeated EAN for a person', async () => {
    const receipt = await importLines([
      { code: 'A-1', ean: eanA, name: 'BONECO TESTE A', qty: 4, total: '40.00' },
      { code: 'B-1', ean: null, name: 'CANECA TESTE B', qty: 2, total: '30.00' },
      { code: 'D-1', ean: eanDup, name: 'ITEM COM EAN REPETIDO', qty: 1, total: '9.90' },
    ]);
    expect(receipt.status).toBe('draft');
    expect(receipt.supplier?.document).toBe(cnpj);
    expect(receipt.items.map((item) => item.sku?.sku_id ?? null)).toEqual([skuA, null, null]);
    expect(receipt.items[0]?.match_method).toBe('ean');
    expect(receipt.unmatched_count).toBe(2);
    expect(await levelOf(skuA)).toBe(0);
  });

  it('refuses the same access key twice', async () => {
    const key = digits(44);
    await importLines([{ code: 'A-1', ean: eanA, name: 'X', qty: 1, total: '1.00' }], key);
    await expect(
      importLines([{ code: 'A-1', ean: eanA, name: 'X', qty: 1, total: '1.00' }], key)
    ).rejects.toThrow(/já foi importada/);
  });

  it('does not post while an item is unmatched, and posts once everything is linked or ignored', async () => {
    const receipt = await importLines([
      { code: 'A-1', ean: eanA, name: 'BONECO TESTE A', qty: 4, total: '40.00' },
      { code: 'B-1', ean: null, name: 'CANECA TESTE B', qty: 2, total: '30.00' },
      { code: 'F-1', ean: null, name: 'FRETE', qty: 1, total: '5.00' },
    ]);
    await expect(postReceipt(fx.userId, receipt.receipt_id)).rejects.toThrow(/Ligue a um SKU/);
    expect(
      (
        await prisma.purchaseReceipt.findUniqueOrThrow({
          where: { purchase_receipt_id: receipt.receipt_id },
        })
      ).status
    ).toBe('draft');

    const [, itemB, itemFreight] = receipt.items;
    await updateReceiptItem(fx.userId, receipt.receipt_id, itemB!.receipt_item_id, {
      sku_id: skuB,
    });
    await updateReceiptItem(fx.userId, receipt.receipt_id, itemFreight!.receipt_item_id, {
      ignored: true,
    });

    const before = { a: await levelOf(skuA), b: await levelOf(skuB) };
    const posted = await postReceipt(fx.userId, receipt.receipt_id);
    expect(posted.status).toBe('posted');
    expect(await levelOf(skuA)).toBe(before.a + 4);
    expect(await levelOf(skuB)).toBe(before.b + 2);

    const movement = await prisma.stockMovement.findFirst({
      where: { sku_id: skuA, reference_id: receipt.receipt_id },
    });
    expect(movement).toMatchObject({
      type: 'inbound',
      quantity: 4,
      reference_type: 'purchase_receipt',
    });
    expect((await prisma.sku.findUniqueOrThrow({ where: { sku_id: skuB } })).cost_cents).toBe(1500);
  });

  it('learns the supplier code, so the next note links itself without an EAN', async () => {
    const next = await importLines([
      { code: 'B-1', ean: null, name: 'CANECA TESTE B', qty: 1, total: '20.00' },
    ]);
    expect(next.items[0]?.sku?.sku_id).toBe(skuB);
    expect(next.items[0]?.match_method).toBe('mapping');
  });

  it('averages the cost by the stock on hand', async () => {
    // skuB: 2 em estoque a R$ 15,00; entram 2 a R$ 25,00 -> R$ 20,00.
    const receipt = await importLines([
      { code: 'B-1', ean: null, name: 'CANECA TESTE B', qty: 2, total: '50.00' },
    ]);
    await postReceipt(fx.userId, receipt.receipt_id);
    expect((await prisma.sku.findUniqueOrThrow({ where: { sku_id: skuB } })).cost_cents).toBe(2000);
  });

  it('never posts the same note twice, even at the same time', async () => {
    const receipt = await importLines([
      { code: 'A-1', ean: eanA, name: 'BONECO TESTE A', qty: 3, total: '30.00' },
    ]);
    const before = await levelOf(skuA);
    const results = await Promise.allSettled([
      postReceipt(fx.userId, receipt.receipt_id),
      postReceipt(fx.userId, receipt.receipt_id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await levelOf(skuA)).toBe(before + 3);
  });

  it('keeps a posted note frozen and only deletes drafts', async () => {
    const receipt = await importLines([
      { code: 'A-1', ean: eanA, name: 'BONECO TESTE A', qty: 1, total: '10.00' },
    ]);
    await postReceipt(fx.userId, receipt.receipt_id);
    await expect(deleteReceipt(fx.userId, receipt.receipt_id)).rejects.toThrow(/já foi lançada/);
    await expect(
      updateReceiptItem(fx.userId, receipt.receipt_id, receipt.items[0]!.receipt_item_id, {
        quantity: 9,
      })
    ).rejects.toThrow(/já foi lançada/);

    const draft = await importLines([
      { code: 'A-1', ean: eanA, name: 'BONECO TESTE A', qty: 1, total: '10.00' },
    ]);
    await deleteReceipt(fx.userId, draft.receipt_id);
    expect(
      await prisma.purchaseReceipt.count({ where: { purchase_receipt_id: draft.receipt_id } })
    ).toBe(0);
  });

  it('corrects quantity and cost of an item (box -> units)', async () => {
    const receipt = await importLines([
      { code: 'B-1', ean: null, name: 'CAIXA COM 12', qty: 1, total: '120.00' },
    ]);
    const updated = await updateReceiptItem(
      fx.userId,
      receipt.receipt_id,
      receipt.items[0]!.receipt_item_id,
      {
        quantity: 12,
        unit_cost_cents: 1000,
      }
    );
    expect(updated.items[0]).toMatchObject({
      quantity: 12,
      unit_cost_cents: 1000,
      total_cost_cents: 12000,
    });
  });

  it('suggests SKUs by name for an unmatched item', async () => {
    const receipt = await importLines([
      { code: 'Z-1', ean: null, name: `IT Produto ${fx.suffix}`, qty: 1, total: '1.00' },
    ]);
    const suggestions = await suggestForItem(receipt.receipt_id, receipt.items[0]!.receipt_item_id);
    expect(suggestions.map((s) => s.sku_id)).toContain(skuA);
    expect(suggestions[0]?.score).toBeGreaterThan(0);
  });

  it('creates a manual draft and posts it', async () => {
    const manual = await createManualReceipt(fx.userId, {
      supplier_name: `Feira ${fx.suffix}`,
      items: [{ description: 'Compra avulsa', quantity: 5, unit_cost_cents: 700, sku_id: skuA }],
    });
    if (manual.supplier) supplierIds.add(manual.supplier.supplier_id);
    expect(manual.total_cents).toBe(3500);
    const before = await levelOf(skuA);
    await postReceipt(fx.userId, manual.receipt_id);
    expect(await levelOf(skuA)).toBe(before + 5);
  });

  it('applies the unit factor, keeps what the supplier charged and learns it for the next note', async () => {
    const first = await importLines([
      { code: 'FX-1', ean: null, name: 'CAIXA COM 12 BONECOS', qty: 2, total: '240.00' },
    ]);
    const item = first.items[0];
    expect(item).toMatchObject({ xml_quantity: 2, unit_factor: 1, quantity: 2 });

    const updated = await updateReceiptItem(fx.userId, first.receipt_id, item!.receipt_item_id, {
      sku_id: skuB,
      unit_factor: 12,
    });
    expect(updated.items[0]).toMatchObject({
      xml_quantity: 2,
      unit_factor: 12,
      quantity: 24,
      unit_cost_cents: 1000,
      total_cost_cents: 24000,
    });

    const before = await levelOf(skuB);
    await postReceipt(fx.userId, first.receipt_id);
    expect(await levelOf(skuB)).toBe(before + 24);

    const next = await importLines([
      { code: 'FX-1', ean: null, name: 'CAIXA COM 12 BONECOS', qty: 3, total: '360.00' },
    ]);
    expect(next.items[0]).toMatchObject({
      match_method: 'mapping',
      xml_quantity: 3,
      unit_factor: 12,
      quantity: 36,
      unit_cost_cents: 1000,
    });
  });

  it('refuses a factor and a quantity in the same edit', () => {
    expect(receiptItemUpdateBodySchema.safeParse({ unit_factor: 12, quantity: 24 }).success).toBe(
      false
    );
    expect(receiptItemUpdateBodySchema.safeParse({ unit_factor: 0 }).success).toBe(false);
  });

  it('keeps the header charges of a manual note', async () => {
    const manual = await createManualReceipt(fx.userId, {
      freight_cents: 1500,
      other_cents: 200,
      items: [{ description: 'Compra com frete', quantity: 1, unit_cost_cents: 1000 }],
    });
    expect(manual.charges).toMatchObject({
      freight_cents: 1500,
      insurance_cents: 0,
      other_cents: 200,
      include_ipi: true,
      apportion_basis: 'value',
    });
    expect(manual.items[0]).toMatchObject({ xml_quantity: 1, unit_factor: 1 });
  });
  const manualNote = (skuId: string, quantity: number, unitCostCents: number) =>
    createManualReceipt(fx.userId, {
      items: [
        {
          description: 'Entrada de teste',
          quantity,
          unit_cost_cents: unitCostCents,
          sku_id: skuId,
        },
      ],
    });
  const costOf = async (skuId: string) =>
    prisma.sku.findUniqueOrThrow({
      where: { sku_id: skuId },
      select: { cost_cents: true, landed_cost_cents: true },
    });

  it('spreads the charges into the landed cost and records the cost history, the movement and the event', async () => {
    const note = await manualNote(skuC, 2, 5000);
    const withFreight = await updateReceiptCharges(fx.userId, note.receipt_id, {
      freight_cents: 1000,
    });
    expect(withFreight.charges.freight_cents).toBe(1000);

    await postReceipt(fx.userId, note.receipt_id);

    // 2 x R$ 50,00 + R$ 10,00 de frete: R$ 55,00 cada com encargos.
    expect(await costOf(skuC)).toEqual({ cost_cents: 5000, landed_cost_cents: 5500 });
    const item = await prisma.purchaseReceiptItem.findFirstOrThrow({
      where: { purchase_receipt_id: note.receipt_id },
      include: { cost_entries: true },
    });
    expect(item.landed_unit_cost_e4).toBe(550000);
    expect(item.cost_entries[0]).toMatchObject({
      quantity_in: 2,
      quantity_before: 0,
      unit_cost_e4: 500000,
      landed_unit_cost_e4: 550000,
      average_cost_after_e4: 500000,
      average_landed_cost_after_e4: 550000,
      reverted_at: null,
    });
    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { sku_id: skuC, reference_id: note.receipt_id },
    });
    expect(movement).toMatchObject({ unit_cost_e4: 550000, on_hand_after: 2 });
    expect(
      await prisma.purchaseReceiptEvent.count({
        where: { purchase_receipt_id: note.receipt_id, type: 'posted', user_id: fx.userId },
      })
    ).toBe(1);

    await expect(
      updateReceiptCharges(fx.userId, note.receipt_id, { freight_cents: 1 })
    ).rejects.toThrow(/já foi lançada/);
  });

  it('averages both costs from the history by the stock on hand', async () => {
    // skuC: 2 em estoque a R$ 50,00 (R$ 55,00 com frete); entram 2 a R$ 70,00 sem encargos.
    const note = await manualNote(skuC, 2, 7000);
    await postReceipt(fx.userId, note.receipt_id);
    expect(await costOf(skuC)).toEqual({ cost_cents: 6000, landed_cost_cents: 6250 });
  });

  it('starts from a cost edited by hand after the last entry', async () => {
    await prisma.sku.update({ where: { sku_id: skuC }, data: { cost_cents: 1000 } });
    const note = await manualNote(skuC, 2, 3000);
    await postReceipt(fx.userId, note.receipt_id);
    // 4 em estoque a R$ 10,00 (o valor editado) + 2 a R$ 30,00 = R$ 16,67.
    expect((await costOf(skuC)).cost_cents).toBe(1667);
  });

  it('excludes IPI from the landed cost when the note says so', async () => {
    const note = await manualNote(skuB, 1, 10000);
    await updateReceiptCharges(fx.userId, note.receipt_id, { ipi_cents: 500, include_ipi: false });
    await postReceipt(fx.userId, note.receipt_id);
    const entry = await prisma.skuCostEntry.findFirstOrThrow({
      where: { item: { purchase_receipt_id: note.receipt_id } },
    });
    // IPI fora: o custo com encargos é o de aquisição.
    expect(entry.landed_unit_cost_e4).toBe(entry.unit_cost_e4);
  });

  it('gives the same average when two notes of the same SKU post at the same time', async () => {
    const [cheap, dear] = await Promise.all([manualNote(skuD, 2, 4000), manualNote(skuD, 2, 6000)]);
    await Promise.all([
      postReceipt(fx.userId, cheap.receipt_id),
      postReceipt(fx.userId, dear.receipt_id),
    ]);
    expect((await costOf(skuD)).cost_cents).toBe(5000);
    const entries = await prisma.skuCostEntry.findMany({
      where: { sku_id: skuD },
      orderBy: { created_at: 'asc' },
    });
    expect(entries.map((entry) => entry.quantity_before)).toEqual([0, 2]);
  });
  const statusOf = async (receiptId: string) =>
    (await prisma.purchaseReceipt.findUniqueOrThrow({ where: { purchase_receipt_id: receiptId } }))
      .status;
  const postedNote = async (skuId: string, quantity: number, unitCostCents: number) => {
    const note = await manualNote(skuId, quantity, unitCostCents);
    await postReceipt(fx.userId, note.receipt_id);
    return note;
  };

  it('reverts the last note: stock and cost go back, the note is a draft again and can be posted again', async () => {
    await postedNote(skuE, 2, 5000);
    const second = await postedNote(skuE, 2, 7000);
    expect(await costOf(skuE)).toEqual({ cost_cents: 6000, landed_cost_cents: 6000 });
    expect(await levelOf(skuE)).toBe(4);

    const reverted = await revertReceipt(fx.userId, second.receipt_id, {
      reason: 'Lançada no SKU errado',
    });
    expect(reverted.status).toBe('draft');
    expect(reverted.posted_at).toBeNull();
    expect(await levelOf(skuE)).toBe(2);
    expect(await costOf(skuE)).toEqual({ cost_cents: 5000, landed_cost_cents: 5000 });

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { sku_id: skuE, reference_type: 'purchase_receipt_reversal' },
    });
    expect(movement).toMatchObject({ type: 'outbound', quantity: -2, on_hand_after: 2 });
    const events = await prisma.purchaseReceiptEvent.findMany({
      where: { purchase_receipt_id: second.receipt_id },
      orderBy: { created_at: 'asc' },
    });
    expect(events.map((event) => event.type)).toEqual(['posted', 'reverted']);
    expect(events[1]?.reason).toBe('Lançada no SKU errado');

    await postReceipt(fx.userId, second.receipt_id);
    expect(await levelOf(skuE)).toBe(4);
    expect(await costOf(skuE)).toEqual({ cost_cents: 6000, landed_cost_cents: 6000 });
  });

  it('reverting an older note rebuilds the cost of the notes that came after it', async () => {
    await postedNote(skuF, 2, 5000);
    const middle = await postedNote(skuF, 2, 7000);
    await postedNote(skuF, 2, 10000);
    // 2 a R$ 50 + 2 a R$ 70 -> R$ 60; com 4 em estoque, + 2 a R$ 100 -> R$ 73,33.
    expect((await costOf(skuF)).cost_cents).toBe(7333);

    await revertReceipt(fx.userId, middle.receipt_id, { reason: 'Nota duplicada' });
    // Sem a nota do meio: 2 a R$ 50 + 2 a R$ 100 -> R$ 75,00.
    expect(await costOf(skuF)).toEqual({ cost_cents: 7500, landed_cost_cents: 7500 });
    expect(await levelOf(skuF)).toBe(4);

    const entries = await prisma.skuCostEntry.findMany({
      where: { sku_id: skuF },
      orderBy: { created_at: 'asc' },
    });
    expect(entries.map((entry) => Boolean(entry.reverted_at))).toEqual([false, true, false]);
    expect(entries[2]?.average_cost_after_e4).toBe(750000);

    // Reverter de novo não desfaz o que já foi refeito (o replay parte dos valores originais).
    const later = entries[2];
    const lastNote = await prisma.purchaseReceiptItem.findUniqueOrThrow({
      where: { purchase_receipt_item_id: later?.purchase_receipt_item_id ?? '' },
    });
    await revertReceipt(fx.userId, lastNote.purchase_receipt_id, { reason: 'Outra nota errada' });
    expect(await costOf(skuF)).toEqual({ cost_cents: 5000, landed_cost_cents: 5000 });
  });

  it('refuses to revert when the stock was already sold, and changes nothing', async () => {
    const note = await postedNote(skuG, 3, 5000);
    await createMovement(fx.userId, {
      sku_id: skuG,
      location_id: fx.locationId,
      type: 'outbound',
      quantity: 2,
      reason: 'venda',
    });

    await expect(
      revertReceipt(fx.userId, note.receipt_id, { reason: 'Tentando desfazer' })
    ).rejects.toThrow(/Não dá para desprocessar/);

    expect(await statusOf(note.receipt_id)).toBe('posted');
    expect(await levelOf(skuG)).toBe(1);
    expect(await costOf(skuG)).toEqual({ cost_cents: 5000, landed_cost_cents: 5000 });
    expect(
      await prisma.skuCostEntry.count({ where: { sku_id: skuG, reverted_at: { not: null } } })
    ).toBe(0);
    expect(
      await prisma.purchaseReceiptEvent.count({
        where: { purchase_receipt_id: note.receipt_id, type: 'reverted' },
      })
    ).toBe(0);
  });

  it('only reverts a posted note, and never twice at the same time', async () => {
    const draft = await manualNote(skuE, 1, 100);
    await expect(
      revertReceipt(fx.userId, draft.receipt_id, { reason: 'Ainda é rascunho' })
    ).rejects.toThrow(/não está lançada/);

    const note = await postedNote(skuE, 1, 100);
    const before = await levelOf(skuE);
    const results = await Promise.allSettled([
      revertReceipt(fx.userId, note.receipt_id, { reason: 'Clique duplo' }),
      revertReceipt(fx.userId, note.receipt_id, { reason: 'Clique duplo' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await levelOf(skuE)).toBe(before - 1);
  });
});
