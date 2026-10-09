'use client';

import {
  COUPON_KIND_LABELS,
  type Coupon,
  type CouponBody,
  type CouponKind,
  couponKindSchema,
  couponRuleIssue,
  toCents,
} from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  Action,
  Dialog,
  FieldDate,
  FieldInput,
  FieldNumber,
  FieldSelect,
  FieldSwitch,
} from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { fromDateTimeLocal, toDateTimeLocal } from '../lib/format';
import { useCreateCoupon, useUpdateCoupon } from '../services/pricing/mutations';
import { CouponCategoriesField } from './coupon-categories-field';

const BRL = { style: 'currency', currency: 'BRL' } as const;
const KIND_OPTIONS = couponKindSchema.options.map((kind) => ({
  value: kind,
  label: COUPON_KIND_LABELS[kind],
}));

// Os valores do formulário são o que a pessoa digita (reais, data local); `toBody` converte para o contrato.
const formSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,40}$/, 'Use de 3 a 40 letras, números, hífen ou sublinhado'),
    kind: couponKindSchema,
    percent: z.number().int().nullable(),
    amount: z.number().min(0).nullable(),
    min_subtotal: z.number().min(0).nullable(),
    max_uses: z.number().int().min(1, 'No mínimo 1').nullable(),
    starts_at: z.string(),
    ends_at: z.string(),
    is_active: z.boolean(),
    category_ids: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    const issue = couponRuleIssue({
      kind: values.kind,
      value: couponValue(values),
      starts_at: fromDateTimeLocal(values.starts_at),
      ends_at: fromDateTimeLocal(values.ends_at),
    });
    if (!issue) return;
    const path = issue.includes('fim')
      ? 'ends_at'
      : values.kind === 'percent'
        ? 'percent'
        : 'amount';
    ctx.addIssue({ code: 'custom', path: [path], message: issue });
  });
type FormValues = z.infer<typeof formSchema>;

/** Valor do desconto no contrato: pontos percentuais, ou centavos; frete grátis não tem valor. */
function couponValue(values: Pick<FormValues, 'kind' | 'percent' | 'amount'>): number {
  if (values.kind === 'percent') return values.percent ?? 0;
  if (values.kind === 'amount') return toCents(values.amount ?? 0);
  return 0;
}

const toBody = (values: FormValues): CouponBody => ({
  code: values.code.trim().toUpperCase(),
  kind: values.kind,
  value: couponValue(values),
  min_subtotal_cents: toCents(values.min_subtotal ?? 0),
  max_uses: values.max_uses,
  starts_at: fromDateTimeLocal(values.starts_at),
  ends_at: fromDateTimeLocal(values.ends_at),
  is_active: values.is_active,
  category_ids: values.category_ids,
});

const emptyValues = (): FormValues => ({
  code: '',
  kind: 'percent',
  percent: 10,
  amount: null,
  min_subtotal: null,
  max_uses: null,
  starts_at: '',
  ends_at: '',
  is_active: true,
  category_ids: [],
});

const fromCoupon = (coupon: Coupon): FormValues => ({
  code: coupon.code,
  kind: coupon.kind,
  percent: coupon.kind === 'percent' ? coupon.value : null,
  amount: coupon.kind === 'amount' ? coupon.value / 100 : null,
  min_subtotal: coupon.min_subtotal_cents ? coupon.min_subtotal_cents / 100 : null,
  max_uses: coupon.max_uses,
  starts_at: toDateTimeLocal(coupon.starts_at),
  ends_at: toDateTimeLocal(coupon.ends_at),
  is_active: coupon.is_active,
  category_ids: coupon.category_ids,
});

/** `{}` = novo cupom; `{ coupon }` = edição; `null` = fechado. */
export type CouponFormTarget = { coupon?: Coupon };

export function CouponForm({
  target,
  onClose,
}: {
  target: CouponFormTarget | null;
  onClose: () => void;
}) {
  const editing = target?.coupon;
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const [formError, setFormError] = useState('');

  const defaults = useMemo(() => (editing ? fromCoupon(editing) : emptyValues()), [editing]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), values: defaults });
  const kind: CouponKind = useWatch({ control, name: 'kind' });
  const codeLocked = Boolean(editing && editing.uses > 0);

  const submit = async (values: FormValues) => {
    setFormError('');
    const body = toBody(values);
    try {
      if (editing) {
        await updateCoupon.mutateAsync({
          coupon_id: editing.coupon_id,
          // O código só vai se mudou (a API recusa trocar o de um cupom já usado).
          body: body.code === editing.code ? { ...body, code: undefined } : body,
        });
      } else {
        await createCoupon.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={target !== null}
      onChange={(open) => !open && onClose()}
      title={editing ? 'Editar cupom' : 'Novo cupom'}
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <Controller
            control={control}
            name="code"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Código"
                description={
                  codeLocked
                    ? 'Este cupom já foi usado: o código não muda.'
                    : 'O cliente digita no carrinho (sempre em maiúsculas).'
                }
                disabled={codeLocked}
                maxLength={40}
                placeholder="GEEK10"
              />
            )}
          />
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="kind"
              render={({ field, fieldState }) => (
                <FieldSelect
                  field={field}
                  fieldState={fieldState}
                  label="Tipo de benefício"
                  options={KIND_OPTIONS}
                />
              )}
            />
            {kind === 'percent' && (
              <Controller
                control={control}
                name="percent"
                render={({ field, fieldState }) => (
                  <FieldNumber
                    field={field}
                    fieldState={fieldState}
                    label="Desconto (%)"
                    minValue={1}
                    maxValue={100}
                  />
                )}
              />
            )}
            {kind === 'amount' && (
              <Controller
                control={control}
                name="amount"
                render={({ field, fieldState }) => (
                  <FieldNumber
                    field={field}
                    fieldState={fieldState}
                    label="Desconto (R$)"
                    minValue={0}
                    formatOptions={BRL}
                  />
                )}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="min_subtotal"
              render={({ field, fieldState }) => (
                <FieldNumber
                  field={field}
                  fieldState={fieldState}
                  label="Pedido mínimo (R$)"
                  description="Em branco: sem mínimo. Com categorias, conta só os itens delas."
                  required={false}
                  minValue={0}
                  formatOptions={BRL}
                />
              )}
            />
            <Controller
              control={control}
              name="max_uses"
              render={({ field, fieldState }) => (
                <FieldNumber
                  field={field}
                  fieldState={fieldState}
                  label="Limite de usos"
                  description="Em branco: sem limite."
                  required={false}
                  minValue={1}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="starts_at"
              render={({ field, fieldState }) => (
                <FieldDate field={field} fieldState={fieldState} label="Vale a partir de" />
              )}
            />
            <Controller
              control={control}
              name="ends_at"
              render={({ field, fieldState }) => (
                <FieldDate field={field} fieldState={fieldState} label="Vale até" />
              )}
            />
          </div>
          <Controller
            control={control}
            name="category_ids"
            render={({ field }) => (
              <CouponCategoriesField value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="is_active"
            render={({ field, fieldState }) => (
              <FieldSwitch field={field} fieldState={fieldState} label="Cupom ativo" />
            )}
          />
          {formError && (
            <p className="error m-0" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Action className="action-outline" onPress={onClose}>
              Cancelar
            </Action>
            <Action type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Action>
          </div>
        </form>
      )}
    </Dialog>
  );
}
