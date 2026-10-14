import { z } from 'zod';

import { dataResponse } from './common';
import { onlyDigits } from './documents';

const zipField = z
  .string()
  .trim()
  .transform((value) => onlyDigits(value))
  .refine((value) => value.length === 8, 'CEP com 8 dígitos');

export const zipParamsSchema = z.object({ zip: zipField });

export const zipLookupSchema = z.object({
  zip: z.string(),
  street: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
});
export type ZipLookup = z.infer<typeof zipLookupSchema>;
export const zipLookupResponseSchema = dataResponse(zipLookupSchema);

export const cartLineSchema = z.object({
  sku_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const shippingQuoteBodySchema = z.object({
  zip: zipField,
  items: z.array(cartLineSchema).min(1).max(100),
});
export type ShippingQuoteBody = z.infer<typeof shippingQuoteBodySchema>;

/** Retirada na loja: o único código fixo. Os demais vêm do provedor de frete (`me:<id do serviço>`) ou da estimativa (`standard`, `express`). */
export const PICKUP_SERVICE_CODE = 'pickup';
export const shippingServiceCodeSchema = z.string().trim().min(1).max(40);
export type ShippingServiceCode = z.infer<typeof shippingServiceCodeSchema>;

export const shippingOptionSchema = z.object({
  code: shippingServiceCodeSchema,
  carrier: z.string(),
  service: z.string(),
  price_cents: z.number().int(),
  days_min: z.number().int(),
  days_max: z.number().int(),
  /** O frete grátis por valor mínimo foi aplicado. */
  free: z.boolean(),
  /** `true` quando o valor é uma estimativa por região (provedor de frete fora do ar ou sem chave). */
  estimated: z.boolean().default(false),
});
export type ShippingOption = z.infer<typeof shippingOptionSchema>;

export const shippingQuoteSchema = z.object({
  state: z.string().nullable(),
  options: z.array(shippingOptionSchema),
  /** Quanto falta para o frete grátis (0 quando já vale). */
  free_shipping_missing_cents: z.number().int(),
});
export type ShippingQuote = z.infer<typeof shippingQuoteSchema>;
export const shippingQuoteResponseSchema = dataResponse(shippingQuoteSchema);
