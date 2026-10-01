import { skuUpdateBodySchema } from '@geekstore/shared';
import { z } from 'zod';

/**
 * `code` é imutável (RF-CAT-02) e não faz parte do contrato de edição. Aceitamos o campo só para
 * poder recusar uma tentativa de troca com erro claro em vez de ignorá-la em silêncio; enviar o
 * mesmo valor atual é inofensivo (clientes que reenviam o SKU inteiro continuam funcionando).
 */
export const skuUpdateRequestSchema = skuUpdateBodySchema.extend({ code: z.string().optional() });
export type SkuUpdateRequest = z.infer<typeof skuUpdateRequestSchema>;
