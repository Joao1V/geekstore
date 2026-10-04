import { z } from 'zod';

import { dataResponse, isoDateTimeSchema, paginatedResponse, paginationQuerySchema } from './common';

// Nota de entrada: a NF-e do fornecedor vira um rascunho, os itens são ligados aos SKUs e só ao
// "lançar" a nota o estoque recebe as entradas e o custo é atualizado.

export const receiptStatusSchema = z.enum(['draft', 'posted']);
export const receiptMatchMethodSchema = z.enum(['mapping', 'ean', 'manual']);

const skuRefSchema = z.object({
  sku_id: z.string().uuid(),
  code: z.string(),
  product_name: z.string(),
});

export const receiptItemSchema = z.object({
  receipt_item_id: z.string().uuid(),
  line: z.number().int(),
  supplier_code: z.string().nullable(),
  description: z.string(),
  ean: z.string().nullable(),
  ncm: z.string().nullable(),
  quantity: z.number().int(),
  unit_cost_cents: z.number().int(),
  total_cost_cents: z.number().int(),
  match_method: receiptMatchMethodSchema.nullable(),
  ignored: z.boolean(),
  sku: skuRefSchema.nullable(),
});
export type ReceiptItem = z.infer<typeof receiptItemSchema>;

const supplierSchema = z.object({
  supplier_id: z.string().uuid(),
  name: z.string(),
  document: z.string().nullable(),
});

export const receiptSummarySchema = z.object({
  receipt_id: z.string().uuid(),
  number: z.string().nullable(),
  series: z.string().nullable(),
  access_key: z.string().nullable(),
  issued_at: isoDateTimeSchema.nullable(),
  supplier: supplierSchema.nullable(),
  total_cents: z.number().int(),
  status: receiptStatusSchema,
  item_count: z.number().int(),
  /** Itens ainda sem SKU e não ignorados: enquanto houver, a nota não pode ser lançada. */
  unmatched_count: z.number().int(),
  created_at: isoDateTimeSchema,
  posted_at: isoDateTimeSchema.nullable(),
});
export type ReceiptSummary = z.infer<typeof receiptSummarySchema>;

export const receiptDetailSchema = receiptSummarySchema.extend({
  location_id: z.string().uuid(),
  notes: z.string().nullable(),
  items: z.array(receiptItemSchema),
});
export type ReceiptDetail = z.infer<typeof receiptDetailSchema>;

export const receiptListQuerySchema = paginationQuerySchema.extend({
  status: receiptStatusSchema.optional(),
  q: z.string().trim().max(120).optional(),
});
export type ReceiptListQuery = z.infer<typeof receiptListQuerySchema>;

export const receiptListResponseSchema = paginatedResponse(receiptSummarySchema);
export const receiptResponseSchema = dataResponse(receiptDetailSchema);

/** Importa o XML da NF-e (texto) como rascunho. Sem `location_id`, usa o primeiro depósito. */
export const receiptImportBodySchema = z.object({
  xml: z.string().min(50).max(5_000_000),
  location_id: z.string().uuid().optional(),
});
export type ReceiptImportBody = z.infer<typeof receiptImportBodySchema>;

/** Nota sem XML (compra informal, cupom): o fornecedor e os itens são digitados. */
export const receiptManualBodySchema = z.object({
  supplier_name: z.string().trim().min(1).max(255).optional(),
  number: z.string().trim().max(20).optional(),
  location_id: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(500),
        quantity: z.number().int().positive(),
        unit_cost_cents: z.number().int().min(0),
        sku_id: z.string().uuid().optional(),
      })
    )
    .min(1)
    .max(500),
});
export type ReceiptManualBody = z.infer<typeof receiptManualBodySchema>;

export const receiptParamsSchema = z.object({ receipt_id: z.string().uuid() });
export const receiptItemParamsSchema = receiptParamsSchema.extend({
  item_id: z.string().uuid(),
});

/** Ajuste de um item do rascunho: ligar a um SKU, ignorar, ou corrigir quantidade/custo (ex.: caixa -> unidades). */
export const receiptItemUpdateBodySchema = z
  .object({
    sku_id: z.string().uuid().nullable(),
    ignored: z.boolean(),
    quantity: z.number().int().positive(),
    unit_cost_cents: z.number().int().min(0),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Informe ao menos um campo.');
export type ReceiptItemUpdateBody = z.infer<typeof receiptItemUpdateBodySchema>;

export const skuSuggestionSchema = z.object({
  sku_id: z.string().uuid(),
  code: z.string(),
  product_name: z.string(),
  /** 0 a 1: quanto o nome se parece com a descrição da nota. */
  score: z.number(),
});
export type SkuSuggestion = z.infer<typeof skuSuggestionSchema>;
export const skuSuggestionListResponseSchema = dataResponse(z.array(skuSuggestionSchema));
