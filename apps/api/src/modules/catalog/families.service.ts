import { deriveSuffix, type Prisma, prisma, valueCodeOf } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { slugify } from '../migration/erp/text';
import {
  FAMILY_CATEGORIES,
  type FamilyChange,
  type FamilyPlan,
  type PlanProduct,
  planFamilies,
} from './families';

const PAGE_SIZE = 500;
const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };
// Ordem dos sufixos no código do SKU: modelo, cor, depois o que mede.
const SUFFIX_ORDER = [
  'modelo',
  'cor',
  'edicao',
  'tamanho',
  'tamanho_infantil',
  'numeracao',
  'sabor',
  'peso',
  'capacidade',
];

const productInclude = {
  category: { select: { slug: true, parent: { select: { slug: true } } } },
  skus: {
    where: { merged_into_sku_id: null },
    orderBy: { code: 'asc' },
    select: {
      sku_id: true,
      code: true,
      attribute_values: {
        select: { attribute: { select: { code: true } }, value: { select: { label: true } } },
      },
    },
  },
} satisfies Prisma.ProductInclude;

type LoadedProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const toPlanProduct = (row: LoadedProduct): PlanProduct => ({
  product_id: row.product_id,
  code: row.code,
  name: row.name,
  category_id: row.category_id,
  category_slug: row.category.slug,
  root_slug: row.category.parent?.slug ?? row.category.slug,
  skus: row.skus.map((sku) => ({
    sku_id: sku.sku_id,
    code: sku.code,
    attrs: Object.fromEntries(
      sku.attribute_values.map((entry) => [entry.attribute.code, entry.value.label])
    ),
  })),
});

/** Todos os produtos das categorias onde a normalização por famílias vale. */
export async function loadFamilyProducts(): Promise<PlanProduct[]> {
  const out: PlanProduct[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.product.findMany({
      where: { status: { not: 'archived' }, category: { slug: { in: [...FAMILY_CATEGORIES] } } },
      orderBy: { product_id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { product_id: cursor }, skip: 1 } : {}),
      include: productInclude,
    });
    if (page.length === 0) return out;
    out.push(...page.map(toPlanProduct));
    cursor = page[page.length - 1]?.product_id;
  }
}

export const planFromDatabase = async (): Promise<FamilyPlan> =>
  planFamilies(await loadFamilyProducts());

// ── Aplicação ───────────────────────────────────────────────────────────────

type ValueIndex = {
  attributeIds: Map<string, string>;
  /** `atributo|código do valor` -> id; `atributo|#suffixes` guarda os sufixos já usados. */
  values: Map<string, string>;
  suffixes: Map<string, Set<string>>;
};

async function loadValueIndex(): Promise<ValueIndex> {
  const attributes = await prisma.attribute.findMany({
    select: {
      attribute_id: true,
      code: true,
      values: { select: { attribute_value_id: true, code: true, sku_suffix: true } },
    },
  });
  const values = new Map<string, string>();
  const suffixes = new Map<string, Set<string>>();
  for (const attribute of attributes) {
    suffixes.set(attribute.code, new Set(attribute.values.map((value) => value.sku_suffix)));
    for (const value of attribute.values) {
      values.set(`${attribute.code}|${value.code}`, value.attribute_value_id);
    }
  }
  return {
    attributeIds: new Map(attributes.map((attribute) => [attribute.code, attribute.attribute_id])),
    values,
    suffixes,
  };
}

/** O valor existe (pelo código, sem acento) ou é criado, com um sufixo de SKU que ninguém usa ainda. */
async function ensureValue(
  index: ValueIndex,
  attribute: string,
  label: string
): Promise<{ attributeId: string; valueId: string }> {
  const attributeId = index.attributeIds.get(attribute);
  if (!attributeId) throw new Error(`Atributo "${attribute}" fora do catálogo.`);
  const code = valueCodeOf(label);
  const known = index.values.get(`${attribute}|${code}`);
  if (known) return { attributeId, valueId: known };

  const taken = index.suffixes.get(attribute) ?? new Set<string>();
  const base = deriveSuffix(label);
  let suffix = base;
  for (let n = 2; taken.has(suffix); n += 1) suffix = `${base.slice(0, 10)}${n}`;
  const created = await prisma.attributeValue.create({
    data: { attribute_id: attributeId, code, label, sku_suffix: suffix, position: 0 },
    select: { attribute_value_id: true },
  });
  taken.add(suffix);
  index.suffixes.set(attribute, taken);
  index.values.set(`${attribute}|${code}`, created.attribute_value_id);
  return { attributeId, valueId: created.attribute_value_id };
}

async function uniqueSlug(
  tx: Prisma.TransactionClient,
  name: string,
  code: string,
  productId: string
): Promise<string> {
  const base = slugify(name).slice(0, 200) || code.toLowerCase();
  const taken = await tx.product.findFirst({
    where: { slug: base, NOT: { product_id: productId } },
    select: { product_id: true },
  });
  return taken ? `${base}-${code.toLowerCase()}` : base;
}

async function applyChange(
  change: FamilyChange,
  index: ValueIndex,
  categoryId: string
): Promise<void> {
  // Valores primeiro (fora da transação): criar valor novo é idempotente e barato.
  const resolved = new Map<string, { attributeId: string; valueId: string }>();
  for (const sku of change.skus) {
    for (const [attribute, label] of Object.entries(sku.attrs)) {
      const key = `${attribute}|${label}`;
      if (!resolved.has(key)) resolved.set(key, await ensureValue(index, attribute, label));
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const donorId of change.donorIds) {
      const donorSkus = change.skus.filter((sku) => sku.product_id === donorId);
      await tx.sku.updateMany({
        where: { sku_id: { in: donorSkus.map((sku) => sku.sku_id) } },
        data: { product_id: change.survivorId },
      });
      // Foto do produto que entrou: de um SKU só, passa a ser a foto dele; a do produto fica no produto.
      await tx.media.updateMany({
        where: { product_id: donorId },
        data: {
          product_id: change.survivorId,
          ...(donorSkus.length === 1 ? { sku_id: donorSkus[0]?.sku_id } : {}),
        },
      });
      const links = await tx.collectionProduct.findMany({ where: { product_id: donorId } });
      if (links.length > 0) {
        await tx.collectionProduct.createMany({
          data: links.map((link) => ({
            collection_product_id: uuidv7(),
            collection_id: link.collection_id,
            product_id: change.survivorId,
          })),
          skipDuplicates: true,
        });
      }
      const donor = await tx.product.findUniqueOrThrow({ where: { product_id: donorId } });
      const survivor = await tx.product.findUniqueOrThrow({
        where: { product_id: change.survivorId },
      });
      await tx.product.update({
        where: { product_id: change.survivorId },
        data: {
          brand_id: survivor.brand_id ?? donor.brand_id,
          description: survivor.description ?? donor.description,
        },
      });
      await tx.product.update({ where: { product_id: donorId }, data: { status: 'archived' } });
    }

    for (const sku of change.skus) {
      for (const [attribute, label] of Object.entries(sku.attrs)) {
        const { attributeId, valueId } = resolved.get(`${attribute}|${label}`) as {
          attributeId: string;
          valueId: string;
        };
        await tx.skuAttributeValue.upsert({
          where: { sku_id_attribute_id: { sku_id: sku.sku_id, attribute_id: attributeId } },
          update: { attribute_value_id: valueId },
          create: { sku_id: sku.sku_id, attribute_id: attributeId, attribute_value_id: valueId },
        });
      }
    }
    for (const { attributeId } of new Set(resolved.values())) {
      await tx.categoryAttribute.upsert({
        where: { category_id_attribute_id: { category_id: categoryId, attribute_id: attributeId } },
        update: {},
        create: {
          category_id: categoryId,
          attribute_id: attributeId,
          is_required: false,
          position: 99,
        },
      });
    }
    const withCode = change.skus.filter((sku) => sku.nameCode);
    for (const sku of withCode) {
      await tx.sku.updateMany({
        where: { sku_id: sku.sku_id, manufacturer_code: null },
        data: { manufacturer_code: sku.nameCode as string },
      });
    }
    const code = (await tx.product.findUniqueOrThrow({ where: { product_id: change.survivorId } }))
      .code;
    await tx.product.update({
      where: { product_id: change.survivorId },
      data: {
        name: change.name,
        slug: await uniqueSlug(tx, change.name, code, change.survivorId),
      },
    });
  }, TX_OPTIONS);
}

export async function applyFamilyPlan(
  plan: FamilyPlan,
  categoryOf: ReadonlyMap<string, string>,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const index = await loadValueIndex();
  for (const [position, change] of plan.changes.entries()) {
    await applyChange(change, index, categoryOf.get(change.survivorId) as string);
    onProgress?.(position + 1, plan.changes.length);
  }
}

// ── Códigos de SKU ──────────────────────────────────────────────────────────

type SkuForCode = {
  sku_id: string;
  code: string;
  parts: { attribute: string; suffix: string }[];
};

const sizePart = (suffix: string): string => suffix.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

/** O código que o SKU deve ter: o do produto, mais o sufixo de cada variação na ordem fixa. */
export function desiredSkuCode(productCode: string, sku: SkuForCode, skuCount: number): string {
  if (sku.parts.length === 0 && skuCount === 1) return productCode;
  const rank = (attribute: string) => {
    const at = SUFFIX_ORDER.indexOf(attribute);
    return at === -1 ? SUFFIX_ORDER.length : at;
  };
  const ordered = [...sku.parts].sort(
    (a, b) => rank(a.attribute) - rank(b.attribute) || a.attribute.localeCompare(b.attribute)
  );
  return [productCode, ...ordered.map((part) => sizePart(part.suffix))].join('-');
}

export type RecodeResult = { renamed: number; skipped: { product: string; reason: string }[] };

/**
 * Refaz o código dos SKUs que não seguem o do produto (SKU que veio de outro produto numa mescla,
 * variação que ganhou cor ou modelo). Duas fases, para dois SKUs poderem trocar de código.
 */
export async function recodeSkus(onlyProductIds?: ReadonlySet<string>): Promise<RecodeResult> {
  const rows = await prisma.product.findMany({
    where: { status: { not: 'archived' } },
    select: {
      product_id: true,
      code: true,
      skus: {
        where: { merged_into_sku_id: null },
        select: {
          sku_id: true,
          code: true,
          attribute_values: {
            select: {
              attribute: { select: { code: true } },
              value: { select: { sku_suffix: true } },
            },
          },
        },
      },
    },
  });

  const updates: { sku_id: string; from: string; to: string }[] = [];
  const skipped: RecodeResult['skipped'] = [];
  for (const product of rows) {
    const touched = onlyProductIds?.has(product.product_id) ?? false;
    const foreign = product.skus.some((sku) => !sku.code.startsWith(product.code));
    if (!touched && !foreign) continue;
    const wanted = product.skus.map((sku) => ({
      sku,
      to: desiredSkuCode(
        product.code,
        {
          sku_id: sku.sku_id,
          code: sku.code,
          parts: sku.attribute_values.map((entry) => ({
            attribute: entry.attribute.code,
            suffix: entry.value.sku_suffix,
          })),
        },
        product.skus.length
      ),
    }));
    if (new Set(wanted.map((entry) => entry.to)).size < wanted.length) {
      skipped.push({ product: product.code, reason: 'duas variações dariam o mesmo código' });
      continue;
    }
    for (const entry of wanted) {
      if (entry.to !== entry.sku.code) {
        updates.push({ sku_id: entry.sku.sku_id, from: entry.sku.code, to: entry.to });
      }
    }
  }
  if (updates.length === 0) return { renamed: 0, skipped };

  const BATCH = 1000;
  await prisma.$transaction(
    async (tx) => {
      for (let start = 0; start < updates.length; start += BATCH) {
        const batch = updates.slice(start, start + BATCH);
        await tx.$executeRaw`
        UPDATE sku SET code = 'TMP-' || sku.sku_id::text
        WHERE sku.sku_id = ANY(${batch.map((u) => u.sku_id)}::uuid[])`;
      }
      for (let start = 0; start < updates.length; start += BATCH) {
        const batch = updates.slice(start, start + BATCH);
        await tx.$executeRaw`
        UPDATE sku SET code = v.code
        FROM unnest(${batch.map((u) => u.sku_id)}::uuid[], ${batch.map((u) => u.to)}::text[]) AS v(sku_id, code)
        WHERE sku.sku_id = v.sku_id`;
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
  return { renamed: updates.length, skipped };
}
