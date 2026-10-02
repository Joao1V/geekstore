import { Prisma } from '@geekstore/db';

// Condições SQL (alias `p` = product) usadas na listagem e nos totais, para os dois sempre
// concordarem sobre o que é "sem foto" e "sem estoque".

export const NO_PHOTO = Prisma.sql`NOT EXISTS (SELECT 1 FROM media m WHERE m.product_id = p.product_id)`;

/** Nenhum SKU do produto tem saldo disponível (físico - reservado) num local vendável. */
export const OUT_OF_STOCK = Prisma.sql`NOT EXISTS (
  SELECT 1
  FROM sku s
  JOIN stock_level sl ON sl.sku_id = s.sku_id
  JOIN location l ON l.location_id = sl.location_id
  WHERE s.product_id = p.product_id AND l.type <> 'quarantine' AND sl.on_hand - sl.reserved > 0
)`;
