import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { slugify } from '../migration/erp/text';
import type { CleanupSuggestion } from './name-cleanup';

const BATCH = 500;
/** Franquia nova só vira coleção se a IA a apontou em pelo menos tantos produtos (evita 1 coleção por item solto). */
export const MIN_PRODUCTS_FOR_NEW_FRANCHISE = 3;
const MANUFACTURER_CODE_MAX = 60;

type ProductRow = { product_id: string; name: string; slug: string };

export type CleanupPlan = {
  renames: { product_id: string; old_name: string; name: string; slug: string }[];
  /** product_id -> slug da coleção (existente ou nova já aprovada). */
  franchiseLinks: { product_id: string; slug: string }[];
  /** Franquias novas aprovadas: slug -> nome. */
  newFranchises: Map<string, string>;
  /** product_id -> códigos de fabricante tirados do nome (viram `manufacturer_code` dos SKUs sem um). */
  codes: Map<string, string[]>;
  skipped: { low_confidence: number; unknown_product: number };
};

/** Decide o que mudar, sem tocar no banco. Confiança baixa não entra: fica para revisão humana. */
export function planCleanup(
  suggestions: readonly CleanupSuggestion[],
  products: readonly ProductRow[],
  existingFranchiseSlugs: ReadonlySet<string>
): CleanupPlan {
  const byId = new Map(products.map((product) => [product.product_id, product]));
  const takenSlugs = new Set(products.map((product) => product.slug));
  const accepted = suggestions.filter((row) => row.confidence !== 'low' && byId.has(row.id));

  const newCounts = new Map<string, { name: string; count: number }>();
  for (const row of accepted) {
    if (row.franchise?.kind !== 'new') continue;
    const slug = slugify(row.franchise.name);
    if (!slug || existingFranchiseSlugs.has(slug)) continue;
    const entry = newCounts.get(slug) ?? { name: row.franchise.name, count: 0 };
    newCounts.set(slug, { name: entry.name, count: entry.count + 1 });
  }
  const newFranchises = new Map(
    [...newCounts]
      .filter(([, entry]) => entry.count >= MIN_PRODUCTS_FOR_NEW_FRANCHISE)
      .map(([slug, entry]) => [slug, entry.name])
  );

  const renames: CleanupPlan['renames'] = [];
  const franchiseLinks: CleanupPlan['franchiseLinks'] = [];
  const codes = new Map<string, string[]>();
  for (const row of accepted) {
    const product = byId.get(row.id) as ProductRow;
    if (row.name !== product.name) {
      renames.push({
        product_id: product.product_id,
        old_name: product.name,
        name: row.name,
        slug: uniqueSlug(row.name, product, takenSlugs),
      });
    }
    if (row.franchise) {
      const slug =
        row.franchise.kind === 'existing' ? row.franchise.slug : slugify(row.franchise.name);
      if (existingFranchiseSlugs.has(slug) || newFranchises.has(slug)) {
        franchiseLinks.push({ product_id: product.product_id, slug });
      }
    }
    if (row.removed_codes.length > 0) codes.set(product.product_id, row.removed_codes);
  }
  return {
    renames,
    franchiseLinks,
    newFranchises,
    codes,
    skipped: {
      low_confidence: suggestions.filter((row) => row.confidence === 'low').length,
      unknown_product: suggestions.filter((row) => !byId.has(row.id)).length,
    },
  };
}

/** Endereço do produto a partir do nome novo; "-2", "-3"... se já existe (o próprio endereço atual vale). */
function uniqueSlug(name: string, product: ProductRow, taken: Set<string>): string {
  const base = slugify(name) || product.slug;
  if (base === product.slug) return base;
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.delete(product.slug);
  taken.add(slug);
  return slug;
}

const manufacturerCodeOf = (codes: readonly string[]): string =>
  codes
    .map((code) => code.replace(/^#/, ''))
    .join(' ')
    .slice(0, MANUFACTURER_CODE_MAX);

export async function loadProducts(): Promise<ProductRow[]> {
  return prisma.$queryRaw<
    ProductRow[]
  >`SELECT product_id::text AS product_id, name, slug FROM product`;
}

/** Grava o plano em lotes. Cada lote é uma transação; o registro de auditoria guarda quantos mudaram. */
export async function applyCleanup(plan: CleanupPlan): Promise<{ runId: string }> {
  const runId = randomUUID();

  if (plan.newFranchises.size > 0) {
    await prisma.collection.createMany({
      data: [...plan.newFranchises].map(([slug, name]) => ({
        collection_id: uuidv7(),
        name,
        slug,
        kind: 'franchise' as const,
      })),
      skipDuplicates: true,
    });
  }

  for (let start = 0; start < plan.renames.length; start += BATCH) {
    const batch = plan.renames.slice(start, start + BATCH);
    await prisma.$executeRaw`
      UPDATE product SET name = v.name, slug = v.slug, updated_at = now()
      FROM unnest(${batch.map((r) => r.product_id)}::uuid[], ${batch.map((r) => r.name)}::text[], ${batch.map((r) => r.slug)}::text[])
        AS v(product_id, name, slug)
      WHERE product.product_id = v.product_id`;
  }

  const collections = await prisma.collection.findMany({
    select: { slug: true, collection_id: true },
  });
  const idBySlug = new Map(collections.map((c) => [c.slug, c.collection_id]));
  const links = plan.franchiseLinks.flatMap((link) => {
    const collectionId = idBySlug.get(link.slug);
    return collectionId
      ? [
          {
            collection_product_id: uuidv7(),
            collection_id: collectionId,
            product_id: link.product_id,
          },
        ]
      : [];
  });
  for (let start = 0; start < links.length; start += BATCH) {
    await prisma.collectionProduct.createMany({
      data: links.slice(start, start + BATCH),
      skipDuplicates: true,
    });
  }

  const codeRows = [...plan.codes].map(([productId, codes]) => ({
    product_id: productId,
    code: manufacturerCodeOf(codes),
  }));
  for (let start = 0; start < codeRows.length; start += BATCH) {
    const batch = codeRows.slice(start, start + BATCH);
    await prisma.$executeRaw`
      UPDATE sku SET manufacturer_code = v.code
      FROM unnest(${batch.map((r) => r.product_id)}::uuid[], ${batch.map((r) => r.code)}::text[]) AS v(product_id, code)
      WHERE sku.product_id = v.product_id AND sku.manufacturer_code IS NULL AND v.code <> ''`;
  }

  await prisma.auditLog.create({
    data: {
      entity: 'ai_cleanup',
      entity_id: runId,
      action: 'update',
      after: {
        renamed: plan.renames.length,
        franchise_links: links.length,
        new_franchises: plan.newFranchises.size,
        manufacturer_codes: codeRows.length,
      },
    },
  });
  return { runId };
}
