import { z } from 'zod';

import { dataResponse } from './common';

/** Preço vigente de um SKU em um canal (na F1, só o canal `site`). */
export const priceSchema = z.object({
  price_id: z.string().uuid(),
  sku_id: z.string().uuid(),
  channel_code: z.string(),
  price_cents: z.number().int(),
  compare_at_cents: z.number().int().nullable(),
});
export type Price = z.infer<typeof priceSchema>;

export const priceListQuerySchema = z.object({ sku_id: z.string().uuid() });
export const priceListResponseSchema = z.object({ data: z.array(priceSchema) });

/** Edição em lote da grade: define o preço base do site de cada SKU (novo registro de vigência). */
export const priceBulkBodySchema = z.object({
  items: z
    .array(z.object({ sku_id: z.string().uuid(), price_cents: z.number().int().min(0) }))
    .min(1)
    .max(500),
});
export type PriceBulkBody = z.infer<typeof priceBulkBodySchema>;
export const priceBulkResponseSchema = dataResponse(z.object({ updated: z.number().int() }));
