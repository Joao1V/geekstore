import { randomInt } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import {
  averageCost,
  createManualReceipt,
  deleteReceipt,
  importReceiptXml,
  postReceipt,
  suggestForItem,
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
    await make('D1', eanDup);
    await make('D2', eanDup);
  });

  afterAll(async () => {
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

  it('computes the weighted average cost', () => {
    expect(averageCost(null, 5, 5, 1000)).toBe(1000);
    expect(averageCost(1000, 0, 5, 2000)).toBe(2000);
    expect(averageCost(1000, 10, 10, 2000)).toBe(1500);
  });
});
