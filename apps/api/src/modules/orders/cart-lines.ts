import { Prisma, prisma } from '@geekstore/db';

import { asUuid } from '../../core/db/sql';
import { currentSitePrice, skuAvailable } from '../storefront/storefront.sql';

/** O que o carrinho e o pedido precisam saber de um SKU à venda, lido do banco no momento. */
export type CartSku = {
  sku_id: string;
  code: string;
  category_id: string;
  product_name: string;
  variant: string | null;
  image_url: string | null;
  price_cents: number;
  weight_g: number | null;
  available: number;
};

type Row = Omit<CartSku, 'price_cents' | 'available'> & {
  price_cents: number | bigint;
  available: number | bigint | string;
};

/**
 * SKUs que a loja pode vender agora (SKU e produto ativos, com preço vigente no site), com preço,
 * saldo disponível e foto. SKU fora dessa regra simplesmente não aparece no resultado: quem chama
 * trata a falta como "item indisponível". O preço NUNCA vem do navegador.
 */
export async function loadCartSkus(skuIds: readonly string[]): Promise<Map<string, CartSku>> {
  const unique = [...new Set(skuIds)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT k.sku_id::text AS sku_id, k.code, p.category_id::text AS category_id,
           p.name AS product_name, k.weight_g,
           pr.price_cents AS price_cents,
           ${skuAvailable} AS available,
           (SELECT string_agg(av.label, ' · ' ORDER BY a.code)
              FROM sku_attribute_value sv
              JOIN attribute_value av ON av.attribute_value_id = sv.attribute_value_id
              JOIN attribute a ON a.attribute_id = sv.attribute_id
             WHERE sv.sku_id = k.sku_id) AS variant,
           COALESCE(
             (SELECT m.url FROM media m WHERE m.sku_id = k.sku_id ORDER BY m.position LIMIT 1),
             (SELECT m.url FROM media m WHERE m.product_id = p.product_id ORDER BY m.position LIMIT 1)
           ) AS image_url
    FROM sku k
    JOIN product p ON p.product_id = k.product_id
    JOIN LATERAL ${currentSitePrice} pr ON TRUE
    WHERE k.sku_id IN (${Prisma.join(unique.map(asUuid))})
      AND k.status = 'active' AND p.status = 'active' AND k.merged_into_sku_id IS NULL`;
  return new Map(
    rows.map((row) => [
      row.sku_id,
      { ...row, price_cents: Number(row.price_cents), available: Number(row.available) },
    ])
  );
}
