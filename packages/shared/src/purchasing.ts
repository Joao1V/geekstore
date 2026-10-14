import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';

// Nota de entrada: a NF-e do fornecedor vira um rascunho, os itens são ligados aos SKUs e só ao
// "lançar" a nota o estoque recebe as entradas e o custo é atualizado.

const MAX_UNIT_FACTOR = 10_000;

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
  /** Quantidade que veio na nota (na unidade do fornecedor, ex.: caixas). */
  xml_quantity: z.number().int(),
  /** Unidades nossas por unidade da nota: `quantity = xml_quantity * unit_factor`. */
  unit_factor: z.number().int().min(1),
  /** Quantidade em unidades nossas: é o que entra no estoque. */
  quantity: z.number().int(),
  unit_cost_cents: z.number().int(),
  total_cost_cents: z.number().int(),
  discount_cents: z.number().int(),
  ipi_cents: z.number().int(),
  icms_st_cents: z.number().int(),
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

export const apportionBasisSchema = z.enum(['value', 'quantity']);

/** Encargos do cabeçalho da nota: entram no custo rateados entre os itens (base `apportion_basis`). */
const receiptChargesSchema = z.object({
  freight_cents: z.number().int().min(0),
  insurance_cents: z.number().int().min(0),
  other_cents: z.number().int().min(0),
  discount_cents: z.number().int().min(0),
  ipi_cents: z.number().int().min(0),
  icms_st_cents: z.number().int().min(0),
  include_ipi: z.boolean(),
  include_icms_st: z.boolean(),
  apportion_basis: apportionBasisSchema,
});

export const receiptDetailSchema = receiptSummarySchema.extend({
  location_id: z.string().uuid(),
  notes: z.string().nullable(),
  charges: receiptChargesSchema,
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
  freight_cents: z.number().int().min(0).optional(),
  insurance_cents: z.number().int().min(0).optional(),
  other_cents: z.number().int().min(0).optional(),
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

/** Encargos do cabeçalho e política de custo da nota (só rascunho). */
export const receiptUpdateBodySchema = z
  .object({
    freight_cents: z.number().int().min(0),
    insurance_cents: z.number().int().min(0),
    other_cents: z.number().int().min(0),
    discount_cents: z.number().int().min(0),
    ipi_cents: z.number().int().min(0),
    icms_st_cents: z.number().int().min(0),
    include_ipi: z.boolean(),
    include_icms_st: z.boolean(),
    apportion_basis: apportionBasisSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Informe ao menos um campo.');
export type ReceiptUpdateBody = z.infer<typeof receiptUpdateBodySchema>;

/** Desprocessar uma nota lançada: devolve a nota a rascunho e tira a entrada do estoque. */
export const receiptRevertBodySchema = z.object({
  reason: z.string().trim().min(5, 'Informe o motivo (mínimo 5 caracteres).').max(500),
});
export type ReceiptRevertBody = z.infer<typeof receiptRevertBodySchema>;

export const receiptEventSchema = z.object({
  event_id: z.string().uuid(),
  type: z.enum(['posted', 'reverted']),
  reason: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  created_at: isoDateTimeSchema,
});
export type ReceiptEvent = z.infer<typeof receiptEventSchema>;
export const receiptEventListResponseSchema = dataResponse(z.array(receiptEventSchema));

export const receiptParamsSchema = z.object({ receipt_id: z.string().uuid() });
export const receiptItemParamsSchema = receiptParamsSchema.extend({
  item_id: z.string().uuid(),
});

/**
 * Ajuste de um item do rascunho: ligar a um SKU, ignorar, ou corrigir a conversão de unidade.
 * `unit_factor` (caixa com 12 = 12) refaz quantidade e custo unitário; `quantity` e `unit_cost_cents`
 * sobrescrevem direto. `unit_factor` e `quantity` não vêm juntos.
 */
export const receiptItemUpdateBodySchema = z
  .object({
    sku_id: z.string().uuid().nullable(),
    ignored: z.boolean(),
    unit_factor: z.number().int().min(1).max(MAX_UNIT_FACTOR),
    quantity: z.number().int().positive(),
    unit_cost_cents: z.number().int().min(0),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Informe ao menos um campo.')
  .refine(
    (body) => body.unit_factor === undefined || body.quantity === undefined,
    'Informe o fator ou a quantidade, não os dois.'
  );
export type ReceiptItemUpdateBody = z.infer<typeof receiptItemUpdateBodySchema>;

export const skuSuggestionSchema = z.object({
  sku_id: z.string().uuid(),
  code: z.string(),
  product_name: z.string(),
  /** 0 a 1: quanto o nome se parece com a descrição da nota. */
  score: z.number(),
  /** Quem sugeriu: a parecença de nomes ou a IA. */
  source: z.enum(['name', 'ai']).default('name'),
  /** Só na IA: o quanto ela confia e o porquê, em uma frase. */
  confidence: z.enum(['high', 'medium', 'low']).nullable().default(null),
  reason: z.string().nullable().default(null),
});
export type SkuSuggestion = z.infer<typeof skuSuggestionSchema>;
/** `ai=true` pede também a escolha da IA (custa uma chamada; por isso só a pedido). */
export const skuSuggestionQuerySchema = z.object({
  ai: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type SkuSuggestionQuery = z.infer<typeof skuSuggestionQuerySchema>;
export const skuSuggestionListResponseSchema = dataResponse(z.array(skuSuggestionSchema));
