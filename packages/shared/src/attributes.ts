import { z } from 'zod';

import { dataResponse } from './common';

const codeSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, 'código em minúsculas, números, hífen ou sublinhado');

// ── Atributos de variação (cor, tamanho...) ────────────────────────────────────
export const attributeValueSchema = z.object({
  attribute_value_id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  sku_suffix: z.string(),
  position: z.number().int(),
  color_hex: z.string().nullable(),
  is_active: z.boolean(),
});
export type AttributeValue = z.infer<typeof attributeValueSchema>;

export const attributeSchema = z.object({
  attribute_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  position: z.number().int(),
  is_active: z.boolean(),
  values: z.array(attributeValueSchema),
});
export type Attribute = z.infer<typeof attributeSchema>;
export const attributeListResponseSchema = dataResponse(z.array(attributeSchema));

const hexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'cor em hexadecimal, ex.: #1F5FBF')
  .nullable();

/** Um valor na tela de edição do atributo: sem `attribute_value_id` = valor novo. */
export const attributeValueInputSchema = z.object({
  attribute_value_id: z.string().uuid().optional(),
  label: z.string().trim().min(1, 'Informe o nome').max(80),
  sku_suffix: z
    .string()
    .trim()
    .min(1, 'Informe o código')
    .max(12)
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Só letras, números e hífen'),
  color_hex: hexSchema.default(null),
  is_active: z.boolean().default(true),
});
export type AttributeValueInput = z.infer<typeof attributeValueInputSchema>;

/**
 * Atributo inteiro de uma vez (nome, situação e a lista de valores NA ORDEM de exibição). Valores
 * que sumiram da lista são excluídos se nenhum SKU os usa; senão a operação é recusada.
 */
export const attributeBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  is_active: z.boolean().default(true),
  values: z.array(attributeValueInputSchema).max(200),
});
export type AttributeBody = z.infer<typeof attributeBodySchema>;

export const attributeCreateBodySchema = attributeBodySchema.extend({
  code: codeSchema.optional(),
});
export type AttributeCreateBody = z.infer<typeof attributeCreateBodySchema>;
export const attributeResponseSchema = dataResponse(attributeSchema);

export const attributeParamsSchema = z.object({ attribute_id: z.string().uuid() });
export type AttributeParams = z.infer<typeof attributeParamsSchema>;

/** Valor novo de um atributo: o `code` sai do rótulo se não vier. */
export const attributeValueBodySchema = z.object({
  label: z.string().trim().min(1).max(80),
  code: codeSchema.optional(),
  /** Final do SKU deste valor (ex.: AZ, GG). Sai do catálogo ou do rótulo se não vier. */
  sku_suffix: z.string().trim().min(1).max(12).optional(),
  color_hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'cor em hexadecimal, ex.: #1F5FBF')
    .nullable()
    .default(null),
});
export type AttributeValueBody = z.infer<typeof attributeValueBodySchema>;
export const attributeValueResponseSchema = dataResponse(attributeValueSchema);

// ── Atributos que uma categoria pede (as subcategorias herdam) ──────────────────
export const categoryAttributeSchema = z.object({
  attribute_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  is_required: z.boolean(),
  /** Categoria de onde vem a regra; difere da consultada quando é herdada. */
  inherited_from: z.string().uuid().nullable(),
});
export type CategoryAttribute = z.infer<typeof categoryAttributeSchema>;
export const categoryAttributeListResponseSchema = dataResponse(z.array(categoryAttributeSchema));

export const categoryAttributesBodySchema = z.object({
  attributes: z
    .array(z.object({ attribute_id: z.string().uuid(), is_required: z.boolean().default(true) }))
    .max(10),
});
export type CategoryAttributesBody = z.infer<typeof categoryAttributesBodySchema>;
