import { type Prisma, prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { utcNow } from '../../core/db/sql';
import { mergeSkus } from './duplicates.service';

// Consolidação do catálogo importado: produtos com o MESMO nome (na mesma categoria) viram um só.
//  1. Mesmo EAN = o mesmo item cadastrado duas vezes: mescla os SKUs (o estoque soma, o código antigo do ERP
//     fica guardado no SKU que saiu, e o preço que vale é o MAIOR dos dois, para não vender abaixo do certo).
//  2. EAN diferente (ou vazio) = itens distintos com nome igual (tamanhos, cores, lotes): viram variações do
//     mesmo produto. Se os SKUs já se distinguem por atributo (tamanho, cor...), o atributo é mantido; senão
//     entra o atributo "Modelo" (Opção 1, Opção 2...). Fotos e franquias vão junto; o produto vazio é arquivado.

const MODEL_ATTRIBUTE = { code: 'modelo', name: 'Modelo' };
const MODEL_VALUE_PREFIX = 'opcao-';

export type Row = {
  product_id: string;
  category_id: string;
  category: string;
  key: string;
  name: string;
  sku_id: string;
  sku_code: string;
  legacy_code: string | null;
  ean: string | null;
  price_cents: number | null;
  photos: number;
  attrs: Record<string, string>;
  sku_count: number;
};

export type ConsolidationPlan = {
  /** Grupos de SKUs com o mesmo EAN: [sobrevivente, ...duplicatas]. */
  sameEan: Row[][];
  /** Produtos com o mesmo nome e itens diferentes: [produto que fica, ...produtos que entram]. */
  variants: Row[][][];
  /** Mesmo nome, mas uma família com tamanhos misturada com itens sem atributo: não dá para decidir sozinho. */
  review: Row[][][];
};

export async function loadRows(): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    WITH counts AS MATERIALIZED (
      SELECT product_id, COUNT(*)::int AS n FROM sku WHERE merged_into_sku_id IS NULL GROUP BY product_id
    ), photos AS MATERIALIZED (
      SELECT product_id, COUNT(*)::int AS n FROM media GROUP BY product_id
    )
    SELECT p.product_id::text, p.category_id::text, c.name AS category,
           regexp_replace(lower(unaccent(regexp_replace(p.name, '#[0-9]+', '', 'g'))), '[^a-z0-9]', '', 'g') AS key,
           p.name, s.sku_id::text, s.code AS sku_code, s.legacy_code, s.ean,
           (SELECT pr.price_cents FROM price pr JOIN channel ch ON ch.channel_id = pr.channel_id
             WHERE pr.sku_id = s.sku_id AND ch.code = 'site'
               AND pr.starts_at <= ${utcNow} AND (pr.ends_at IS NULL OR pr.ends_at > ${utcNow})
             ORDER BY pr.starts_at DESC LIMIT 1) AS price_cents,
           COALESCE(ph.n, 0) AS photos,
           COALESCE((SELECT jsonb_object_agg(a.code, av.code)
                     FROM sku_attribute_value sav
                     JOIN attribute a ON a.attribute_id = sav.attribute_id
                     JOIN attribute_value av ON av.attribute_value_id = sav.attribute_value_id
                     WHERE sav.sku_id = s.sku_id), '{}'::jsonb) AS attrs,
           cn.n AS sku_count
    FROM product p
    JOIN category c ON c.category_id = p.category_id
    JOIN sku s ON s.product_id = p.product_id AND s.merged_into_sku_id IS NULL
    JOIN counts cn ON cn.product_id = p.product_id
    LEFT JOIN photos ph ON ph.product_id = p.product_id
    WHERE p.status <> 'archived'`;
}

const legacyNumber = (row: Row): number => Number(row.legacy_code ?? Number.MAX_SAFE_INTEGER);
const bySurvivor = (a: Row, b: Row): number =>
  b.photos - a.photos || legacyNumber(a) - legacyNumber(b) || a.sku_code.localeCompare(b.sku_code);

export function planConsolidation(rows: readonly Row[]): ConsolidationPlan {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.key) continue;
    const id = `${row.category_id}|${row.key}`;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  const sameEan: Row[][] = [];
  const variants: Row[][][] = [];
  const review: Row[][][] = [];

  for (const members of groups.values()) {
    if (new Set(members.map((row) => row.product_id)).size < 2) continue;
    // 1. Mesmo EAN, só entre produtos simples (1 SKU).
    const byEan = new Map<string, Row[]>();
    for (const row of members) {
      if (row.sku_count === 1 && row.ean) byEan.set(row.ean, [...(byEan.get(row.ean) ?? []), row]);
    }
    const merged = new Set<string>();
    for (const same of byEan.values()) {
      if (same.length < 2) continue;
      const sorted = [...same].sort(bySurvivor);
      sameEan.push(sorted);
      for (const row of sorted.slice(1)) merged.add(row.product_id);
    }
    // 2. O que sobrou com o mesmo nome vira variações de um produto só.
    const remaining = members.filter((row) => !merged.has(row.product_id));
    const products = new Map<string, Row[]>();
    for (const row of remaining) {
      products.set(row.product_id, [...(products.get(row.product_id) ?? []), row]);
    }
    if (products.size < 2) continue;
    const ordered = [...products.values()].sort((a, b) => bySurvivor(a[0] as Row, b[0] as Row));
    // Só junta o que dá para distinguir sem chute: atributos que não repetem, ou itens soltos (1 SKU cada),
    // que ganham o atributo "Modelo". Família com tamanhos + item sem tamanho vai para revisão.
    if (
      distinguishedByAttributes(ordered.flat()) ||
      ordered.every((product) => product.length === 1)
    ) {
      variants.push(ordered);
    } else {
      review.push(ordered);
    }
  }
  return { sameEan, variants, review };
}

// ── Execução ─────────────────────────────────────────────────────────────────

async function ensureModelValues(
  count: number
): Promise<{ attributeId: string; valueIds: string[] }> {
  const attribute = await prisma.attribute.upsert({
    where: { code: MODEL_ATTRIBUTE.code },
    update: {},
    create: { code: MODEL_ATTRIBUTE.code, name: MODEL_ATTRIBUTE.name, position: 99 },
  });
  const valueIds: string[] = [];
  for (let n = 1; n <= count; n++) {
    const value = await prisma.attributeValue.upsert({
      where: {
        attribute_id_code: {
          attribute_id: attribute.attribute_id,
          code: `${MODEL_VALUE_PREFIX}${n}`,
        },
      },
      update: {},
      create: {
        attribute_id: attribute.attribute_id,
        code: `${MODEL_VALUE_PREFIX}${n}`,
        label: `Opção ${n}`,
        sku_suffix: `O${n}`,
        position: n,
      },
    });
    valueIds.push(value.attribute_value_id);
  }
  return { attributeId: attribute.attribute_id, valueIds };
}

const tupleKey = (attrs: Record<string, string>): string =>
  JSON.stringify(Object.entries(attrs).sort());

/** Os SKUs do grupo já se distinguem por atributo (todos têm e nenhum repete)? */
export function distinguishedByAttributes(skus: readonly Row[]): boolean {
  if (skus.some((sku) => Object.keys(sku.attrs).length === 0)) return false;
  return new Set(skus.map((sku) => tupleKey(sku.attrs))).size === skus.length;
}

async function raisePrice(tx: Prisma.TransactionClient, survivor: Row, group: readonly Row[]) {
  const highest = Math.max(...group.map((row) => row.price_cents ?? 0));
  if (!highest || highest === survivor.price_cents) return;
  const current = await tx.price.findFirst({
    where: { sku_id: survivor.sku_id, channel: { code: 'site' } },
    orderBy: { starts_at: 'desc' },
  });
  if (current) {
    await tx.price.update({
      where: { price_id: current.price_id },
      data: { price_cents: highest },
    });
  }
}

export async function mergeSameEan(actorId: string, group: readonly Row[]): Promise<void> {
  const [survivor, ...duplicates] = group as [Row, ...Row[]];
  await prisma.$transaction((tx) => raisePrice(tx, survivor, group));
  await mergeSkus(actorId, {
    survivor_sku_id: survivor.sku_id,
    duplicate_sku_ids: duplicates.map((row) => row.sku_id),
  });
}

export async function mergeAsVariants(group: readonly Row[][]): Promise<void> {
  const [keep, ...incoming] = group as [Row[], ...Row[][]];
  const survivorId = keep[0]?.product_id as string;
  const allSkus = group.flat();
  const needsModel = !distinguishedByAttributes(allSkus);
  const model = needsModel ? await ensureModelValues(allSkus.length) : null;

  await prisma.$transaction(
    async (tx) => {
      for (const other of incoming) {
        const otherId = other[0]?.product_id as string;
        const skuIds = other.map((row) => row.sku_id);
        await tx.sku.updateMany({
          where: { sku_id: { in: skuIds } },
          data: { product_id: survivorId },
        });
        // Foto do produto que entrou passa a ser a foto daquele SKU (aparece quando o cliente o escolhe).
        await tx.media.updateMany({
          where: { product_id: otherId },
          data: { product_id: survivorId, ...(other.length === 1 ? { sku_id: skuIds[0] } : {}) },
        });
        const links = await tx.collectionProduct.findMany({ where: { product_id: otherId } });
        if (links.length > 0) {
          await tx.collectionProduct.createMany({
            data: links.map((link) => ({
              collection_product_id: uuidv7(),
              collection_id: link.collection_id,
              product_id: survivorId,
            })),
            skipDuplicates: true,
          });
        }
        const donor = await tx.product.findUniqueOrThrow({ where: { product_id: otherId } });
        const survivor = await tx.product.findUniqueOrThrow({ where: { product_id: survivorId } });
        await tx.product.update({
          where: { product_id: survivorId },
          data: {
            brand_id: survivor.brand_id ?? donor.brand_id,
            description: survivor.description ?? donor.description,
          },
        });
        await tx.product.update({ where: { product_id: otherId }, data: { status: 'archived' } });
      }
      if (model) {
        const ordered = [...allSkus].sort(
          (a, b) => legacyNumber(a) - legacyNumber(b) || a.sku_code.localeCompare(b.sku_code)
        );
        for (const [index, sku] of ordered.entries()) {
          await tx.skuAttributeValue.upsert({
            where: { sku_id_attribute_id: { sku_id: sku.sku_id, attribute_id: model.attributeId } },
            update: { attribute_value_id: model.valueIds[index] as string },
            create: {
              sku_id: sku.sku_id,
              attribute_id: model.attributeId,
              attribute_value_id: model.valueIds[index] as string,
            },
          });
        }
        await tx.categoryAttribute.upsert({
          where: {
            category_id_attribute_id: {
              category_id: keep[0]?.category_id as string,
              attribute_id: model.attributeId,
            },
          },
          update: {},
          create: {
            category_id: keep[0]?.category_id as string,
            attribute_id: model.attributeId,
            is_required: false,
            position: 99,
          },
        });
      }
    },
    { timeout: 60_000 }
  );
}
