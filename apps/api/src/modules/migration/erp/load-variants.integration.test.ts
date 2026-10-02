import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { afterAll, describe, expect, it } from 'vitest';

import { toSku } from '../../catalog/catalog.mappers';
import { skuAttributeInclude } from '../../catalog/sku-attributes';
import { erpRowSchema } from './erp-row';
import type { ErpSource } from './erp-source';
import { runImport } from './load';

const NOW = new Date('2026-10-02T12:00:00Z');
const suffix = randomUUID().slice(0, 6).toUpperCase();
const base = randomInt(9_000_000, 9_900_000);
const LINE = `LINHAZ${suffix.replace(/\d/g, 'K')}`;

const shirt = (offset: number, nome: string) =>
  erpRowSchema.parse({
    codigo: base + offset,
    nome,
    grupo: 'VESTUÁRIO #',
    subgrupo: `SUB ${suffix} #`,
    preco_venda: 80,
    estoque: 2,
    fotos: [`https://cdn.exemplo.com/${suffix}.jpg`],
  });

const rows = [
  shirt(1, `CAMISETA ${LINE} PRETO P`),
  shirt(2, `CAMISETA ${LINE} PRETO M`),
  shirt(3, `CAMISETA ${LINE} BRANCO P`),
];
const source: ErpSource = { rows, invalid: [], sha256: 'teste-var', total: rows.length };
const codes = rows.map((r) => String(r.codigo));

afterAll(async () => {
  const skus = await prisma.sku.findMany({
    where: { legacy_code: { in: codes } },
    select: { sku_id: true, product_id: true },
  });
  const skuIds = skus.map((s) => s.sku_id);
  const productIds = [...new Set(skus.map((s) => s.product_id))];
  await prisma.media.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.price.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockMovement.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockLevel.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.sku.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.product.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.category.deleteMany({
    where: { parent_id: { not: null }, name: { contains: suffix, mode: 'insensitive' } },
  });
  await prisma.auditLog.deleteMany({
    where: { entity: 'erp_import', after: { path: ['source_sha256'], equals: 'teste-var' } },
  });
  await prisma.$disconnect();
});

describe('runImport: variations (integration — requires a live DATABASE_URL)', () => {
  it('stores colour/size variants as ONE product with readable SKUs and the ERP code kept', async () => {
    const result = await runImport(source, NOW);
    expect(result.inserted).toMatchObject({ products: 1, skus: 3, media: 1 });

    const skus = await prisma.sku.findMany({
      where: { legacy_code: { in: codes } },
      include: { product: { include: { media: true } }, ...skuAttributeInclude },
      orderBy: { legacy_code: 'asc' },
    });
    expect(new Set(skus.map((s) => s.product_id)).size).toBe(1);
    expect(skus.map((s) => toSku(s).attributes)).toEqual([
      { cor: 'preto', tamanho: 'p' },
      { cor: 'preto', tamanho: 'm' },
      { cor: 'branco', tamanho: 'p' },
    ]);
    expect(skus.map((s) => s.code.split('-').slice(-2).join('-'))).toEqual([
      'PT-P',
      'PT-M',
      'BC-P',
    ]);
    expect(skus.every((s) => !s.code.startsWith('ERP-'))).toBe(true);
    expect(skus.map((s) => s.legacy_code)).toEqual(codes);
    expect(skus[0]?.product.name).toBe(`Camiseta ${LINE[0]}${LINE.slice(1).toLowerCase()}`);
  });
});
