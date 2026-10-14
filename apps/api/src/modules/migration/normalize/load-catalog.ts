import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ensureAttributeCatalog, ensureCategoryCatalog, type Prisma, prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';
import { recordMovements } from '../../stock/movement-writer';
import {
  ensureAttributeValues,
  ensureBrands,
  linkCategoryAttributes,
} from '../erp/load-attributes';
import {
  BATCH_SIZE,
  type BatchContext,
  buildBatchRows,
  chunkByProduct,
  type LoadItem,
} from '../erp/load-batch';
import {
  type NormalizedCatalog,
  type NormalizedProduct,
  normalizedCatalogSchema,
} from './catalog-file';
import { FRANCHISES } from './franchise';

const STOCK = { reason: 'Carga inicial do catálogo', reference: 'catalog_import' };

const TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

async function insertBatch(tx: Prisma.TransactionClient, rows: ReturnType<typeof buildBatchRows>) {
  // Ordem das chaves estrangeiras: produto -> sku -> o resto.
  await tx.product.createMany({ data: rows.products });
  await tx.sku.createMany({ data: rows.skus });
  if (rows.skuAttributes.length > 0) {
    await tx.skuAttributeValue.createMany({ data: rows.skuAttributes });
  }
  await tx.price.createMany({ data: rows.prices });
  await tx.stockLevel.createMany({ data: rows.levels });
  await recordMovements(tx, rows.movements);
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

export function readCatalogFile(path: string): NormalizedCatalog {
  return normalizedCatalogSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

const date = (value: string | null): Date | null => (value ? new Date(value) : null);

/** Um produto do arquivo -> uma linha por SKU, no formato que a carga em lote já entende. */
function toLoadItems(product: NormalizedProduct): (LoadItem & { collections: string[] })[] {
  return product.skus.map((sku) => ({
    legacyCode: null,
    legacyData: null,
    skuCode: sku.code,
    productKey: product.code,
    productCode: product.code,
    hasVariants: product.has_variants,
    attributes: sku.attributes,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryKey: product.category,
    productStatus: product.status,
    skuStatus: sku.status,
    ean: sku.ean,
    manufacturerCode: sku.manufacturer_code,
    brandName: product.brand,
    ncm: sku.ncm,
    weightG: sku.weight_g,
    lengthMm: sku.length_mm,
    widthMm: sku.width_mm,
    heightMm: sku.height_mm,
    priceCents: sku.price_cents,
    promo: sku.promo
      ? {
          priceCents: sku.promo.price_cents,
          compareAtCents: sku.promo.compare_at_cents,
          startsAt: date(sku.promo.starts_at),
          endsAt: date(sku.promo.ends_at),
        }
      : null,
    stock: sku.stock,
    photos: product.photos,
    ownPhotos: sku.photos,
    collections: product.collections,
  }));
}

/** Cria (ou reaproveita, pelo endereço) as coleções de franquia usadas; devolve `slug -> collection_id`. */
async function ensureCollections(
  slugs: Iterable<string>,
  definitions: readonly { slug: string; name: string }[]
): Promise<Map<string, string>> {
  const used = new Set(slugs);
  const known = new Map<string, { slug: string; name: string }>(
    FRANCHISES.map((franchise) => [franchise.slug, franchise])
  );
  // As definições do próprio arquivo vencem a lista fixa: é onde as franquias novas (da faxina) chegam.
  for (const definition of definitions) known.set(definition.slug, definition);
  const wanted = [...known.values()].filter((franchise) => used.has(franchise.slug));
  await prisma.collection.createMany({
    data: wanted.map((franchise) => ({
      collection_id: uuidv7(),
      name: franchise.name,
      slug: franchise.slug,
      kind: 'franchise' as const,
    })),
    skipDuplicates: true,
  });
  const rows = await prisma.collection.findMany({
    where: { slug: { in: wanted.map((franchise) => franchise.slug) } },
    select: { slug: true, collection_id: true },
  });
  return new Map(rows.map((row) => [row.slug, row.collection_id]));
}

/** Leva o contador de cada tipo ao maior número usado (nunca recua). */
async function advanceSequences(lastNumbers: Readonly<Record<string, number>>): Promise<void> {
  for (const [prefix, last] of Object.entries(lastNumbers)) {
    await prisma.$executeRaw`
      INSERT INTO sku_sequence (prefix, last_value, updated_at) VALUES (${prefix}, ${last}, now())
      ON CONFLICT (prefix) DO UPDATE
        SET last_value = GREATEST(sku_sequence.last_value, EXCLUDED.last_value), updated_at = now()`;
  }
}

export type CatalogImportResult = {
  runId: string;
  alreadyImported: number;
  inserted: {
    products: number;
    skus: number;
    prices: number;
    stockLevels: number;
    movements: number;
    media: number;
    collectionLinks: number;
  };
};

/**
 * Importa o arquivo normalizado. Reexecutar é seguro: produto cujo código já existe é pulado. Se algum
 * código de SKU ou endereço colidir com o que está no banco, o UNIQUE recusa (a carga para, não duplica).
 */
export async function importCatalog(
  catalog: NormalizedCatalog,
  now: Date
): Promise<CatalogImportResult> {
  const runId = randomUUID();
  const existing = new Set(
    (await prisma.product.findMany({ select: { code: true } })).map((product) => product.code)
  );
  const pending = catalog.products.filter((product) => !existing.has(product.code));
  const items = pending.flatMap(toLoadItems);

  await ensureAttributeCatalog(prisma);
  const taxonomy = await ensureCategoryCatalog(prisma);
  const source = { items };
  const attributeValueIds = await ensureAttributeValues(source);
  const brandIds = await ensureBrands(source);
  await linkCategoryAttributes(source, taxonomy.ids, attributeValueIds);
  const collectionIds = await ensureCollections(
    pending.flatMap((product) => product.collections),
    catalog.collections ?? []
  );
  const base = await loadContext();
  const ctx: BatchContext = {
    ...base,
    categoryIds: taxonomy.ids,
    attributeValueIds,
    brandIds,
    now,
    importMeta: {
      run_id: runId,
      source_sha256: catalog.source_sha256,
      imported_at: now.toISOString(),
    },
    stock: STOCK,
  };

  const collectionsByCode = new Map(pending.map((product) => [product.code, product.collections]));
  const inserted = {
    products: 0,
    skus: 0,
    prices: 0,
    stockLevels: 0,
    movements: 0,
    media: 0,
    collectionLinks: 0,
  };
  for (const [index, batch] of chunkByProduct(items, BATCH_SIZE).entries()) {
    const rows = buildBatchRows(batch, ctx);
    const links = rows.products.flatMap((product) =>
      (collectionsByCode.get(product.code) ?? []).flatMap((slug) => {
        const collectionId = collectionIds.get(slug);
        return collectionId
          ? [
              {
                collection_product_id: uuidv7(),
                collection_id: collectionId,
                product_id: product.product_id as string,
              },
            ]
          : [];
      })
    );
    await prisma.$transaction(async (tx) => {
      await insertBatch(tx, rows);
      if (links.length > 0) await tx.collectionProduct.createMany({ data: links });
    }, TRANSACTION_OPTIONS);
    inserted.products += rows.products.length;
    inserted.skus += rows.skus.length;
    inserted.prices += rows.prices.length;
    inserted.stockLevels += rows.levels.length;
    inserted.movements += rows.movements.length;
    inserted.media += rows.media.length;
    inserted.collectionLinks += links.length;
    console.log(`  lote ${index + 1}: ${inserted.skus}/${items.length} SKUs`);
  }

  await advanceSequences(lastNumbersOf(catalog));
  if (inserted.skus > 0) {
    await prisma.auditLog.create({
      data: {
        entity: 'catalog_import',
        entity_id: runId,
        action: 'create',
        after: { source_sha256: catalog.source_sha256, ...inserted },
      },
    });
  }
  return { runId, alreadyImported: existing.size, inserted };
}

/** Maior número usado por tipo no arquivo ("CNC-00042" -> CNC: 42). */
export function lastNumbersOf(catalog: NormalizedCatalog): Record<string, number> {
  const last: Record<string, number> = {};
  for (const product of catalog.products) {
    const match = product.code.match(/^([A-Z]+)-(\d+)$/);
    if (!match) continue;
    last[match[1]!] = Math.max(last[match[1]!] ?? 0, Number(match[2]));
  }
  return last;
}
