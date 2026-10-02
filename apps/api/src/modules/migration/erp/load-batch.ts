import type { Prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import { type AttributeValueIds, attributeKey } from './load-attributes';
import type { PlannedItem } from './plan-types';

export const BATCH_SIZE = 500;
export const STOCK_REASON = 'Carga inicial do ERP';
export const STOCK_REFERENCE = 'erp_import';
// Início do preço base: bem antes de qualquer promoção, para a promoção sempre vencer a vigência.
const BASE_PRICE_STARTS_AT = new Date('2000-01-01T00:00:00Z');

export type BatchContext = {
  attributeValueIds: AttributeValueIds;
  categoryIds: ReadonlyMap<string, string>;
  siteChannelId: string;
  warehouseId: string;
  now: Date;
  importMeta: { run_id: string; source_sha256: string; imported_at: string };
};

/** Todas as linhas de um lote de itens, com ids UUID v7 já gerados (nada depende de leitura do banco). */
export function buildBatchRows(items: PlannedItem[], ctx: BatchContext) {
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
  for (const item of items) {
    const categoryId = ctx.categoryIds.get(item.categoryKey);
    if (!categoryId)
      throw new Error(`Categoria sem id para o item ${item.legacyCode}: ${item.categoryKey}`);
    const skuId = uuidv7();
    // Variações do mesmo produto compartilham a linha de produto e as fotos.
    const known = productIds.get(item.productKey);
    const productId = known ?? uuidv7();
    if (!known) {
      productIds.set(item.productKey, productId);
      rows.products.push({
        product_id: productId,
        category_id: categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        status: item.productStatus,
      });
      for (const [position, url] of item.photos.entries()) {
        rows.media.push({
          media_id: uuidv7(),
          product_id: productId,
          url,
          alt: `${item.name} (foto ${position + 1})`.slice(0, 255),
          position,
        });
      }
    }
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
      status: item.skuStatus,
      legacy_code: item.legacyCode,
      legacy_data: { ...item.legacyData, import: ctx.importMeta } as Prisma.InputJsonValue,
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
        reason: STOCK_REASON,
        reference_type: STOCK_REFERENCE,
      });
    }
  }
  return rows;
}

/**
 * Lotes de ~`size` itens que nunca partem um produto ao meio: as variações de um produto vão
 * juntas (o produto é criado uma vez por lote). Os itens de um produto são contíguos no plano.
 */
export function chunkByProduct(items: PlannedItem[], size: number): PlannedItem[][] {
  const batches: PlannedItem[][] = [];
  for (const item of items) {
    const current = batches.at(-1);
    const startsNewProduct = current?.at(-1)?.productKey !== item.productKey;
    if (current && !(startsNewProduct && current.length >= size)) current.push(item);
    else batches.push([item]);
  }
  return batches;
}
