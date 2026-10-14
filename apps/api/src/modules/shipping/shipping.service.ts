import type { ShippingQuote, ShippingQuoteBody } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';
import { type CartSku, loadCartSkus } from '../orders/cart-lines';
import { shippingOptionsFor } from './shipping-options';
import type { ShippingItem } from './shipping-provider';

/** O SKU como o frete o enxerga. */
export const toShippingItem = (sku: CartSku, quantity: number): ShippingItem => ({
  quantity,
  unitPriceCents: sku.price_cents,
  weightG: sku.weight_g,
  lengthMm: sku.length_mm,
  widthMm: sku.width_mm,
  heightMm: sku.height_mm,
});

/** Cotação do carrinho: o subtotal, o peso e as medidas vêm do banco (preço do site e SKU), não do cliente. */
export async function quoteForItems(body: ShippingQuoteBody): Promise<ShippingQuote> {
  const skus = await loadCartSkus(body.items.map((item) => item.sku_id));
  let subtotalCents = 0;
  const items = body.items.map((item) => {
    const sku = skus.get(item.sku_id);
    if (!sku) throw new BadRequestError('Algum item do carrinho não está mais à venda.');
    subtotalCents += sku.price_cents * item.quantity;
    return toShippingItem(sku, item.quantity);
  });
  return shippingOptionsFor({ zip: body.zip, items, subtotalCents });
}
