import { Prisma } from '@geekstore/db';
import type { ProductIssue } from '@geekstore/shared';

import { utcNow } from '../../core/db/sql';

// Condições SQL (alias `p` = product) usadas na listagem, nos totais e no painel, para os três
// sempre concordarem sobre o que é "sem foto", "sem estoque", "sem preço"...

export const NO_PHOTO = Prisma.sql`NOT EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.product_id)`;

/** Nenhum SKU do produto tem saldo disponível (físico - reservado) num local vendável. */
export const OUT_OF_STOCK = Prisma.sql`NOT EXISTS (
  SELECT 1
  FROM sku s
  JOIN stock_level sl ON sl.sku_id = s.sku_id
  JOIN location l ON l.location_id = sl.location_id
  WHERE s.product_id = p.product_id AND l.type <> 'quarantine' AND sl.on_hand - sl.reserved > 0
)`;

/** Algum SKU do produto não tem preço vigente no site (não dá para vender). */
const NO_PRICE = Prisma.sql`EXISTS (
  SELECT 1 FROM sku s
  WHERE s.product_id = p.product_id
    AND NOT EXISTS (
      SELECT 1 FROM price pr
      JOIN channel c ON c.channel_id = pr.channel_id
      WHERE pr.sku_id = s.sku_id AND c.code = 'site'
        AND pr.starts_at <= ${utcNow} AND (pr.ends_at IS NULL OR pr.ends_at > ${utcNow})
    )
)`;

const NO_BRAND = Prisma.sql`p.brand_id IS NULL`;
const NO_DESCRIPTION = Prisma.sql`(p.description IS NULL OR btrim(p.description) = '')`;

/** Algum SKU sem peso: sem ele o frete não é calculado. */
const NO_WEIGHT = Prisma.sql`EXISTS (SELECT 1 FROM sku s WHERE s.product_id = p.product_id AND s.weight_g IS NULL)`;

export const ISSUE_CONDITIONS: Record<ProductIssue, Prisma.Sql> = {
  no_photo: NO_PHOTO,
  out_of_stock: OUT_OF_STOCK,
  no_price: NO_PRICE,
  no_brand: NO_BRAND,
  no_description: NO_DESCRIPTION,
  no_weight: NO_WEIGHT,
};
