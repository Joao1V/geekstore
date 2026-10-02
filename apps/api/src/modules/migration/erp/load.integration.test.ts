import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { afterAll, describe, expect, it } from 'vitest';

import { reconcileStock } from '../../stock/stock-reconcile.service';
import { erpRowSchema } from './erp-row';
import type { ErpSource } from './erp-source';
import { runImport } from './load';

const NOW = new Date('2026-10-02T12:00:00Z');
const suffix = randomUUID().slice(0, 8).toUpperCase();
const base = randomInt(8_000_000, 8_900_000);
const GROUP = `ZZ TESTE ${suffix} #`;

const row = (offset: number, overrides: Record<string, unknown> = {}) =>
  erpRowSchema.parse({
    codigo: base + offset,
    nome: `ITEM DE TESTE ${suffix} ${offset}`,
    grupo: GROUP,
    subgrupo: `SUB ${suffix} #`,
    codigo_barras: '7898572679235',
    preco_venda: 50,
    estoque: 4,
    fotos: [`https://cdn.exemplo.com/${suffix}-${offset}.jpg`],
    ...overrides,
  });

const rows = [
  row(1, { preco_venda: 99.9, preco_promocao: 84.9 }),
  row(2, { estoque: 0 }),
  row(3, { fotos: [], estoque: -5 }),
  row(4, { nome: `ITEM DE TESTE ${suffix} 1` }), // mesmo nome do item 1
  row(5, { grupo: 'USO E CONSUMO #', subgrupo: 'USO E CONSUMO #' }), // pulado
];
const source: ErpSource = { rows, invalid: [], sha256: 'teste', total: rows.length };
const codes = rows.map((r) => String(r.codigo));

afterAll(async () => {
  const skus = await prisma.sku.findMany({
    where: { legacy_code: { in: codes } },
    select: { sku_id: true, product_id: true },
  });
  const skuIds = skus.map((s) => s.sku_id);
  const productIds = skus.map((s) => s.product_id);
  await prisma.media.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.price.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockMovement.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockLevel.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.sku.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.product.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.category.deleteMany({
    where: { parent_id: { not: null }, name: { contains: suffix, mode: 'insensitive' } },
  });
  await prisma.category.deleteMany({ where: { name: { contains: suffix, mode: 'insensitive' } } });
  await prisma.auditLog.deleteMany({
    where: { entity: 'erp_import', after: { path: ['source_sha256'], equals: 'teste' } },
  });
  await prisma.$disconnect();
});

describe('runImport (integration — requires a live DATABASE_URL)', () => {
  it('imports items with price, promotion, stock ledger, photos and traceability', async () => {
    const result = await runImport(source, NOW);
    expect(result.inserted).toMatchObject({ products: 4, skus: 4, stockLevels: 4, media: 3 });
    expect(result.plan.skipped.map((s) => s.legacyCode)).toEqual([String(base + 5)]);

    const sku = await prisma.sku.findUniqueOrThrow({
      where: { legacy_code: String(base + 1) },
      include: { product: { include: { media: true } }, prices: true, stock_levels: true },
    });
    expect(sku.code).toBe(`ERP-${base + 1}`);
    expect(sku.status).toBe('active');
    expect(sku.product.status).toBe('active');
    expect(sku.product.media).toHaveLength(1);
    expect(sku.legacy_data).toMatchObject({ codigo: base + 1, import: { source_sha256: 'teste' } });
    expect(sku.stock_levels[0]).toMatchObject({ on_hand: 4, reserved: 0 });
    const [basePrice, promo] = [...sku.prices].sort(
      (a, b) => a.starts_at.getTime() - b.starts_at.getTime()
    );
    expect(basePrice).toMatchObject({ price_cents: 9990, compare_at_cents: null });
    expect(promo).toMatchObject({ price_cents: 8490, compare_at_cents: 9990 });
  });

  it('publishes only what has stock and a photo, and zeroes negative stock', async () => {
    const byCode = async (n: number) =>
      prisma.sku.findUniqueOrThrow({
        where: { legacy_code: String(base + n) },
        include: { product: true, stock_levels: true },
      });
    expect((await byCode(2)).status).toBe('inactive');
    expect((await byCode(2)).product.status).toBe('draft');
    const noPhoto = await byCode(3);
    expect(noPhoto.stock_levels[0]?.on_hand).toBe(0);
    expect(noPhoto.product.status).toBe('draft');
  });

  it('gives a repeated name a distinct slug', async () => {
    const products = await prisma.product.findMany({
      where: { skus: { some: { legacy_code: { in: [String(base + 1), String(base + 4)] } } } },
      select: { slug: true },
    });
    expect(new Set(products.map((p) => p.slug)).size).toBe(2);
  });

  it('keeps the stock ledger consistent with the balances', async () => {
    // Só os SKUs deste teste: outros arquivos de teste mexem em saldos de propósito, em paralelo.
    const ours = new Set(
      (
        await prisma.sku.findMany({
          where: { legacy_code: { in: codes } },
          select: { sku_id: true },
        })
      ).map((sku) => sku.sku_id)
    );
    const { divergences } = await reconcileStock();
    expect(divergences.filter((d) => ours.has(d.sku_id))).toEqual([]);

    const movements = await prisma.stockMovement.aggregate({
      where: { sku_id: { in: [...ours] } },
      _sum: { quantity: true },
    });
    const levels = await prisma.stockLevel.aggregate({
      where: { sku_id: { in: [...ours] } },
      _sum: { on_hand: true },
    });
    expect(movements._sum.quantity).toBe(levels._sum.on_hand);
    expect(levels._sum.on_hand).toBe(8); // itens 1 (4) e 4 (4); o 2 e o 3 entram com saldo 0
  });

  it('is idempotent: a second run imports nothing and reuses the categories', async () => {
    const again = await runImport(source, NOW);
    expect(again.inserted.skus).toBe(0);
    expect(again.plan.items).toHaveLength(0);
    expect(again.categories.created).toBe(0);
    expect(await prisma.sku.count({ where: { legacy_code: { in: codes } } })).toBe(4);
  });
});
