import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';

export const couponKindSchema = z.enum(['percent', 'amount', 'free_shipping']);
export type CouponKind = z.infer<typeof couponKindSchema>;

/** Situação derivada para a lista: o que o lojista quer saber ("posso usar agora?"). */
export const couponStatusSchema = z.enum([
  'active',
  'scheduled',
  'expired',
  'exhausted',
  'inactive',
]);
export type CouponStatus = z.infer<typeof couponStatusSchema>;

export const couponSchema = z.object({
  coupon_id: z.string().uuid(),
  code: z.string(),
  kind: couponKindSchema,
  /** percent: 1 a 100; amount: centavos; free_shipping: sempre 0. */
  value: z.number().int(),
  min_subtotal_cents: z.number().int(),
  max_uses: z.number().int().nullable(),
  uses: z.number().int(),
  starts_at: isoDateTimeSchema.nullable(),
  ends_at: isoDateTimeSchema.nullable(),
  is_active: z.boolean(),
  /** Categorias em que o cupom vale (e as subcategorias delas). Vazio = o carrinho todo. */
  category_ids: z.array(z.string().uuid()),
  status: couponStatusSchema,
  created_at: isoDateTimeSchema,
});
export type Coupon = z.infer<typeof couponSchema>;

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,40}$/, 'Use de 3 a 40 letras, números, hífen ou sublinhado');

// Sem valores padrão aqui: o PATCH só pode alterar o que foi enviado (`.partial()` sobre campos com
// `.default()` reaplicaria o padrão e apagaria limite, mínimo, datas e categorias). Os padrões do
// cadastro entram só no `couponBodySchema`.
const couponFields = {
  code: codeSchema,
  kind: couponKindSchema,
  value: z.number().int().min(0),
  min_subtotal_cents: z.number().int().min(0),
  max_uses: z.number().int().min(1).nullable(),
  starts_at: isoDateTimeSchema.nullable(),
  ends_at: isoDateTimeSchema.nullable(),
  is_active: z.boolean(),
  category_ids: z.array(z.string().uuid()).max(50),
};

type RuleInput = {
  kind: CouponKind;
  value: number;
  starts_at: string | null;
  ends_at: string | null;
};

/** Regra que depende de mais de um campo. Devolve a mensagem do problema, ou `null` se está tudo certo. */
export function couponRuleIssue(input: RuleInput): string | null {
  if (input.kind === 'percent' && (input.value < 1 || input.value > 100)) {
    return 'O desconto percentual vai de 1 a 100.';
  }
  if (input.kind === 'amount' && input.value < 1) return 'Informe o valor do desconto.';
  if (input.kind === 'free_shipping' && input.value !== 0) {
    return 'Frete grátis não tem valor de desconto.';
  }
  if (input.starts_at && input.ends_at && input.ends_at <= input.starts_at) {
    return 'O fim da validade precisa ser depois do início.';
  }
  return null;
}

export const couponBodySchema = z
  .object({
    ...couponFields,
    min_subtotal_cents: couponFields.min_subtotal_cents.default(0),
    max_uses: couponFields.max_uses.default(null),
    starts_at: couponFields.starts_at.default(null),
    ends_at: couponFields.ends_at.default(null),
    is_active: couponFields.is_active.default(true),
    category_ids: couponFields.category_ids.default([]),
  })
  .superRefine((body, ctx) => {
    const issue = couponRuleIssue(body);
    if (issue) ctx.addIssue({ code: 'custom', path: ['value'], message: issue });
  });
export type CouponBody = z.infer<typeof couponBodySchema>;

/** Edição parcial: o que não vem fica como está; a regra de vários campos é conferida na API, já mesclada. */
export const couponUpdateBodySchema = z.object(couponFields).partial();
export type CouponUpdateBody = z.infer<typeof couponUpdateBodySchema>;

export const couponParamsSchema = z.object({ coupon_id: z.string().uuid() });
export type CouponParams = z.infer<typeof couponParamsSchema>;

export const couponListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  status: couponStatusSchema.optional(),
});
export type CouponListQuery = z.infer<typeof couponListQuerySchema>;

export const couponListResponseSchema = paginatedResponse(couponSchema);
export const couponResponseSchema = dataResponse(couponSchema);

export const COUPON_KIND_LABELS: Record<CouponKind, string> = {
  percent: 'Percentual',
  amount: 'Valor fixo',
  free_shipping: 'Frete grátis',
};
export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  active: 'Ativo',
  scheduled: 'Agendado',
  expired: 'Vencido',
  exhausted: 'Esgotado',
  inactive: 'Desativado',
};
