import { z } from 'zod';

import { dataResponse } from './common';

export const brandSchema = z.object({
  brand_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  is_active: z.boolean(),
  product_count: z.number().int(),
});
export type Brand = z.infer<typeof brandSchema>;
export const brandListResponseSchema = dataResponse(z.array(brandSchema));
export const brandResponseSchema = dataResponse(brandSchema);

export const brandBodySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(120),
});
export type BrandBody = z.infer<typeof brandBodySchema>;

export const brandUpdateBodySchema = z
  .object({ name: brandBodySchema.shape.name, is_active: z.boolean() })
  .partial();
export type BrandUpdateBody = z.infer<typeof brandUpdateBodySchema>;

export const brandParamsSchema = z.object({ brand_id: z.string().uuid() });
export type BrandParams = z.infer<typeof brandParamsSchema>;
