import type { Prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import type { PlannedItem } from './plan-types';

export const BATCH_SIZE = 500;
export const STOCK_REASON = 'Carga inicial do ERP';
export const STOCK_REFERENCE = 'erp_import';
// Início do preço base: bem antes de qualquer promoção, para a promoção sempre vencer a vigência.
const BASE_PRICE_STARTS_AT = new Date('2000-01-01T00:00:00Z');

export type BatchContext = {
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
    prices: [] as Prisma.PriceCreateManyInput[],
    levels: [] as Prisma.StockLevelCreateManyInput[],
    movements: [] as Prisma.StockMovementCreateManyInput[],
    media: [] as Prisma.MediaCreateManyInput[],
  };

  for (const item of items) {
    const categoryId = ctx.categoryIds.get(item.categoryKey);
    if (!categoryId)
      throw new Error(`Categoria sem id para o item ${item.legacyCode}: ${item.categoryKey}`);
    const productId = uuidv7();
    const skuId = uuidv7();

    rows.products.push({
      product_id: productId,
      category_id: categoryId,
      name: item.name,
      slug: item.slug,
      description: item.description,
      status: item.productStatus,
    });
    rows.skus.push({
      sku_id: skuId,
      product_id: productId,
      code: item.skuCode,
      ean: item.ean,
      attributes: {},
      weight_g: item.weightG,
      length_mm: item.lengthMm,
      width_mm: item.widthMm,
      height_mm: item.heightMm,
      ncm: item.ncm,
      status: item.skuStatus,
      legacy_code: item.legacyCode,
      legacy_data: { ...item.legacyData, import: ctx.importMeta } as Prisma.InputJsonValue,
    });
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
  return rows;
}
