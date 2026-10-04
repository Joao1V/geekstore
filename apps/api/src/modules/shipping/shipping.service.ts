import type { ShippingQuote, ShippingQuoteBody } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';
import { loadCartSkus } from '../orders/cart-lines';
import { quoteShipping } from './shipping-quote';

const DEFAULT_WEIGHT_G = 300;

/** Cotação do carrinho: o subtotal e o peso vêm do banco (preço do site e peso do SKU), não do cliente. */
export async function quoteForItems(body: ShippingQuoteBody): Promise<ShippingQuote> {
  const skus = await loadCartSkus(body.items.map((item) => item.sku_id));
  let subtotalCents = 0;
  let weightGrams = 0;
  for (const item of body.items) {
    const sku = skus.get(item.sku_id);
    if (!sku) throw new BadRequestError('Algum item do carrinho não está mais à venda.');
    subtotalCents += sku.price_cents * item.quantity;
    weightGrams += (sku.weight_g ?? DEFAULT_WEIGHT_G) * item.quantity;
  }
  return quoteShipping({ zip: body.zip, subtotalCents, weightGrams });
}
