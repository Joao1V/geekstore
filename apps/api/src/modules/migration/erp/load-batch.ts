import type { Prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { type AttributeValueIds, attributeKey } from './load-attributes';
import type { PlannedItem } from './plan-types';

/** Item pronto para gravar. Vem do plano do ERP ou do arquivo normalizado (sem vínculo com o ERP). */
export type LoadItem = Omit<
  PlannedItem,
  'legacyCode' | 'legacyData' | 'erpName' | 'categoryHow'
> & {
  legacyCode: string | null;
  legacyData: Record<string, unknown> | null;
};

export const BATCH_SIZE = 500;
export const STOCK_REASON = 'Carga inicial do ERP';
export const STOCK_REFERENCE = 'erp_import';
// Início do preço base: bem antes de qualquer promoção, para a promoção sempre vencer a vigência.
const BASE_PRICE_STARTS_AT = new Date('2000-01-01T00:00:00Z');

export type BatchContext = {
  attributeValueIds: AttributeValueIds;
  brandIds: ReadonlyMap<string, string>;
  categoryIds: ReadonlyMap<string, string>;
  siteChannelId: string;
  warehouseId: string;
  now: Date;
  importMeta: { run_id: string; source_sha256: string; imported_at: string };
  /** Motivo e referência da entrada inicial no livro-razão (padrão: carga do ERP). */
  stock?: { reason: string; reference: string };
};

/** Todas as linhas de um lote de itens, com ids UUID v7 já gerados (nada depende de leitura do banco). */
export function buildBatchRows(items: LoadItem[], ctx: BatchContext) {
  const rows = {
    products: [] as Prisma.ProductCreateManyInput[],
    skus: [] as Prisma.SkuCreateManyInput[],
    skuAttributes: [] as Prisma.SkuAttributeValueCreateManyInput[],
    prices: [] as Prisma.PriceCreateManyInput[],
    levels: [] as Prisma.StockLevelCreateManyInput[],
    movements: [] as Prisma.StockMovementCreateManyInput[],
    media: [] as Prisma.MediaCreateManyInput[],
  };

  const productIds = new Map<string, string>();
  const firstItemOf = new Map<string, (typeof items)[number]>();
  const mediaCount = new Map<string, number>();
  const seenUrls = new Set<string>();
  /** Fotos de um produto (ou da variação, com `skuId`), em sequência e sem repetir a mesma URL. */
  const pushMedia = (urls: string[], productId: string, skuId: string | null, name: string) => {
    for (const url of urls) {
      const key = `${productId}|${url}`;
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      const position = mediaCount.get(productId) ?? 0;
      mediaCount.set(productId, position + 1);
      rows.media.push({
        media_id: uuidv7(),
        product_id: productId,
        sku_id: skuId,
        url,
        alt: `${name} (foto ${position + 1})`.slice(0, 255),
        position,
      });
    }
  };
  for (const item of items) {
    const categoryId = ctx.categoryIds.get(item.categoryKey);
    if (!categoryId)
      throw new Error(`Categoria sem id para o item ${item.legacyCode}: ${item.categoryKey}`);
    const skuId = uuidv7();
    const isFamily = item.hasVariants;
    // Variações do mesmo produto compartilham a linha de produto e as fotos.
    const known = productIds.get(item.productKey);
    const productId = known ?? uuidv7();
    if (!known) {
      productIds.set(item.productKey, productId);
      firstItemOf.set(item.productKey, item);
      rows.products.push({
        product_id: productId,
        category_id: categoryId,
        code: item.productCode,
        brand_id: item.brandName ? (ctx.brandIds.get(item.brandName) ?? null) : null,
        name: item.name,
        slug: item.slug,
        description: item.description,
        status: item.productStatus,
      });
      if (!isFamily) pushMedia(item.photos, productId, null, item.name);
    }
    // Numa família cada variação leva as fotos dela: escolher a cor no site troca a imagem.
    if (isFamily) pushMedia(item.ownPhotos, productId, skuId, item.name);
    rows.skus.push({
      sku_id: skuId,
      product_id: productId,
      code: item.skuCode,
      ean: item.ean,
      weight_g: item.weightG,
      length_mm: item.lengthMm,
      width_mm: item.widthMm,
      height_mm: item.heightMm,
      ncm: item.ncm,
      manufacturer_code: item.manufacturerCode,
      status: item.skuStatus,
      legacy_code: item.legacyCode,
      legacy_data: item.legacyData
        ? ({ ...item.legacyData, import: ctx.importMeta } as Prisma.InputJsonValue)
        : undefined,
    });
    for (const [attribute, label] of Object.entries(item.attributes)) {
      const ids = ctx.attributeValueIds.get(attributeKey(attribute, label));
      if (!ids) throw new Error(`Valor sem id: ${attribute} ${label}`);
      rows.skuAttributes.push({
        sku_attribute_value_id: uuidv7(),
        sku_id: skuId,
        attribute_id: ids.attributeId,
        attribute_value_id: ids.valueId,
      });
    }
    rows.prices.push({
      price_id: uuidv7(),
      sku_id: skuId,
      channel_id: ctx.siteChannelId,
      price_cents: item.priceCents,
      starts_at: BASE_PRICE_STARTS_AT,
    });
    if (item.promo) {
      rows.prices.push({
        price_id: uuidv7(),
        sku_id: skuId,
        channel_id: ctx.siteChannelId,
        price_cents: item.promo.priceCents,
        compare_at_cents: item.promo.compareAtCents,
        starts_at: item.promo.startsAt ?? ctx.now,
        ends_at: item.promo.endsAt,
      });
    }
    rows.levels.push({
      stock_level_id: uuidv7(),
      sku_id: skuId,
      location_id: ctx.warehouseId,
      on_hand: item.stock,
      reserved: 0,
    });
    // Saldo e movimentação juntos: o livro-razão fecha com o saldo (conferência RF-EST-10).
    if (item.stock > 0) {
      rows.movements.push({
        stock_movement_id: uuidv7(),
        sku_id: skuId,
        location_id: ctx.warehouseId,
        type: 'inbound',
        quantity: item.stock,
        reason: ctx.stock?.reason ?? STOCK_REASON,
        reference_type: ctx.stock?.reference ?? STOCK_REFERENCE,
      });
    }
  }
  // Numa família as fotos de cada variação já entraram acima; o que sobra só do produto (ex.: fotos
  // juntadas na consolidação) entra no fim, no nível do produto. A mesma URL nunca entra duas vezes.
  for (const item of items) {
    if (!item.hasVariants || firstItemOf.get(item.productKey) !== item) continue;
    pushMedia(item.photos, productIds.get(item.productKey) as string, null, item.name);
  }
  return rows;
}

/**
 * Lotes de ~`size` itens que nunca partem um produto ao meio: as variações de um produto vão
 * juntas (o produto é criado uma vez por lote). Os itens de um produto são contíguos no plano.
 */
export function chunkByProduct<T extends { productKey: string }>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (const item of items) {
    const current = batches.at(-1);
    const startsNewProduct = current?.at(-1)?.productKey !== item.productKey;
    if (current && !(startsNewProduct && current.length >= size)) current.push(item);
    else batches.push([item]);
  }
  return batches;
}
