import { randomUUID } from 'node:crypto';
import { type Prisma, prisma } from '@geekstore/db';

import type { ErpSource } from './erp-source';
import { BATCH_SIZE, type BatchContext, buildBatchRows, chunkByProduct } from './load-batch';
import { resolveCategories } from './load-categories';
import { buildPlan } from './plan';
import type { CatalogPlan } from './plan-types';

const TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

export type ImportResult = {
  runId: string;
  plan: CatalogPlan;
  alreadyImported: number;
  categories: { created: number; reused: number };
  inserted: {
    products: number;
    skus: number;
    prices: number;
    stockLevels: number;
    movements: number;
    media: number;
  };
};

async function insertBatch(tx: Prisma.TransactionClient, rows: ReturnType<typeof buildBatchRows>) {
  // Ordem das chaves estrangeiras: produto -> sku -> o resto.
  await tx.product.createMany({ data: rows.products });
  await tx.sku.createMany({ data: rows.skus });
  await tx.price.createMany({ data: rows.prices });
  await tx.stockLevel.createMany({ data: rows.levels });
  if (rows.movements.length > 0) await tx.stockMovement.createMany({ data: rows.movements });
  if (rows.media.length > 0) await tx.media.createMany({ data: rows.media });
}

async function loadContext(): Promise<Pick<BatchContext, 'siteChannelId' | 'warehouseId'>> {
  const [channel, location] = await Promise.all([
    prisma.channel.findUniqueOrThrow({ where: { code: 'site' }, select: { channel_id: true } }),
    prisma.location.findFirstOrThrow({
      where: { type: 'warehouse' },
      orderBy: { created_at: 'asc' },
      select: { location_id: true },
    }),
  ]);
  return { siteChannelId: channel.channel_id, warehouseId: location.location_id };
}

/**
 * Importa para o banco o que ainda não foi importado (chave: `legacy_code`). Reexecutar é seguro:
 * itens já importados são pulados, categorias são reaproveitadas e slugs nunca colidem.
 */
export async function runImport(source: ErpSource, now: Date): Promise<ImportResult> {
  const runId = randomUUID();
  const [imported, products, skuCodes] = await Promise.all([
    prisma.sku.findMany({ where: { legacy_code: { not: null } }, select: { legacy_code: true } }),
    prisma.product.findMany({ select: { slug: true } }),
    prisma.sku.findMany({ select: { code: true } }),
  ]);
  const importedCodes = new Set(imported.map((sku) => sku.legacy_code));
  const pending = source.rows.filter((row) => !importedCodes.has(String(row.codigo)));

  const plan = buildPlan(pending, {
    now,
    takenSlugs: new Set(products.map((p) => p.slug)),
    takenSkuCodes: new Set(skuCodes.map((s) => s.code)),
  });
  const categories = await resolveCategories(plan.categories);
  const base = await loadContext();
  const ctx: BatchContext = {
    ...base,
    categoryIds: categories.ids,
    now,
    importMeta: { run_id: runId, source_sha256: source.sha256, imported_at: now.toISOString() },
  };

  const inserted = { products: 0, skus: 0, prices: 0, stockLevels: 0, movements: 0, media: 0 };
  for (const [index, items] of chunkByProduct(plan.items, BATCH_SIZE).entries()) {
    const rows = buildBatchRows(items, ctx);
    await prisma.$transaction((tx) => insertBatch(tx, rows), TRANSACTION_OPTIONS);
    inserted.products += rows.products.length;
    inserted.skus += rows.skus.length;
    inserted.prices += rows.prices.length;
    inserted.stockLevels += rows.levels.length;
    inserted.movements += rows.movements.length;
    inserted.media += rows.media.length;
    console.log(`  lote ${index + 1}: ${inserted.skus}/${plan.items.length} itens`);
  }

  // Reexecução sem nada novo não gera auditoria.
  if (inserted.skus > 0) {
    await prisma.auditLog.create({
      data: {
        entity: 'erp_import',
        entity_id: runId,
        action: 'create',
        after: {
          source_sha256: source.sha256,
          ...inserted,
          categories: { created: categories.created, reused: categories.reused },
        },
      },
    });
  }

  return {
    runId,
    plan,
    alreadyImported: importedCodes.size,
    categories: { created: categories.created, reused: categories.reused },
    inserted,
  };
}
