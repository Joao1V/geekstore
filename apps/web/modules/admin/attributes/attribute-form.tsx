'use client';

import type { Attribute, AttributeBody } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput, FieldSwitch } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCreateAttribute, useUpdateAttribute } from '../services/catalog/mutations';

const COLOR_ATTRIBUTE = 'cor';
const SUGGESTED_SUFFIX_LENGTH = 3;

const valueSchema = z.object({
  attribute_value_id: z.string().optional(),
  label: z.string().trim().min(1, 'Informe o nome').max(80),
  sku_suffix: z
    .string()
    .trim()
    .min(1, 'Informe o código')
    .max(12, 'No máximo 12')
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Só letras, números e hífen'),
  color_hex: z
    .string()
    .refine((value) => !value || /^#[0-9A-Fa-f]{6}$/.test(value), 'Ex.: #1F5FBF'),
  is_active: z.boolean(),
});

const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome').max(80),
    is_active: z.boolean(),
    values: z.array(valueSchema),
  })
  .superRefine((form, ctx) => {
    const seen = new Set<string>();
    form.values.forEach((value, index) => {
      const suffix = value.sku_suffix.trim().toUpperCase();
      if (suffix && seen.has(suffix)) {
        ctx.addIssue({
          code: 'custom',
          path: ['values', index, 'sku_suffix'],
          message: 'Código repetido',
        });
      }
      seen.add(suffix);
    });
  });
type FormValues = z.infer<typeof formSchema>;

/** Sugestão de código a partir do nome: "Turquesa" -> "TUR", "500ml" -> "500ML". */
function suggestSuffix(label: string): string {
  const plain = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]+$/.test(plain) ? plain.slice(0, SUGGESTED_SUFFIX_LENGTH) : plain.slice(0, 12);
}

const emptyValue = (): FormValues['values'][number] => ({
  label: '',
  sku_suffix: '',
  color_hex: '',
  is_active: true,
});

function toBody(values: FormValues): AttributeBody {
  return {
    name: values.name.trim(),
    is_active: values.is_active,
    values: values.values.map((value) => ({
      ...(value.attribute_value_id ? { attribute_value_id: value.attribute_value_id } : {}),
      label: value.label.trim(),
      sku_suffix: value.sku_suffix.trim().toUpperCase(),
      color_hex: value.color_hex ? value.color_hex.toUpperCase() : null,
      is_active: value.is_active,
    })),
  };
}

/** `{}` = novo atributo; `{ attribute }` = edição; `null` = fechado. */
export type AttributeFormTarget = { attribute?: Attribute };

export function AttributeForm({
  target,
  onClose,
}: {
  target: AttributeFormTarget | null;
  onClose: () => void;
}) {
  const editing = target?.attribute;
  const createAttribute = useCreateAttribute();
  const updateAttribute = useUpdateAttribute();
  const [formError, setFormError] = useState('');
  const hasColor = editing?.code === COLOR_ATTRIBUTE;

  const defaults = useMemo<FormValues>(
    () => ({
      name: editing?.name ?? '',
      is_active: editing?.is_active ?? true,
      values: (editing?.values ?? []).map((value) => ({
        attribute_value_id: value.attribute_value_id,
        label: value.label,
        sku_suffix: value.sku_suffix,
        color_hex: value.color_hex ?? '',
        is_active: value.is_active,
      })),
    }),
    [editing]
  );

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isSubmitting, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), values: defaults });
  const values = useFieldArray({ control, name: 'values' });

  const submit = async (form: FormValues) => {
    setFormError('');
    try {
      if (editing) {
        await updateAttribute.mutateAsync({
          attribute_id: editing.attribute_id,
          body: toBody(form),
        });
      } else {
        await createAttribute.mutateAsync(toBody(form));
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
      title={editing ? `Editar · ${editing.name}` : 'Novo atributo'}
      size="lg"
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="grid gap-5" noValidate>
          <div className="grid grid-cols-[1fr_auto] items-start gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <FieldInput field={field} fieldState={fieldState} label="Nome do atributo" />
              )}
            />
            <Controller
              control={control}
              name="is_active"
              render={({ field, fieldState }) => (
                <FieldSwitch
                  field={field}
                  fieldState={fieldState}
                  heading="Situação"
                  label="Ativo"
                />
              )}
            />
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-extrabold">Valores</p>
            <p className="muted text-xs">
              O código vira o final do SKU (ex.: CAM-01-AZ-M). A ordem daqui é a ordem de exibição.
            </p>
            {values.fields.map((row, index) => (
              <div
                key={row.id}
                className={`grid items-start gap-3 ${
                  hasColor
                    ? 'grid-cols-[auto_1fr_8rem_9rem_auto_auto] max-md:grid-cols-2'
                    : 'grid-cols-[auto_1fr_8rem_auto_auto] max-md:grid-cols-2'
                }`}
              >
                <span className="mt-6 grid gap-0.5 max-md:hidden">
                  <button
                    type="button"
                    aria-label="Subir"
                    disabled={index === 0}
                    className="text-muted disabled:opacity-30"
                    onClick={() => values.move(index, index - 1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Descer"
                    disabled={index === values.fields.length - 1}
                    className="text-muted disabled:opacity-30"
                    onClick={() => values.move(index, index + 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                </span>
                <Controller
                  control={control}
                  name={`values.${index}.label`}
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={{
                        ...field,
                        onChange: (event) => {
                          field.onChange(event);
                          if (!row.attribute_value_id && !dirtyFields.values?.[index]?.sku_suffix) {
                            setValue(
                              `values.${index}.sku_suffix`,
                              suggestSuffix(event.target.value)
                            );
                          }
                        },
                      }}
                      fieldState={fieldState}
                      label="Nome"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`values.${index}.sku_suffix`}
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={field}
                      fieldState={fieldState}
                      label="Código do SKU"
                      maxLength={12}
                    />
                  )}
                />
                {hasColor && (
                  <Controller
                    control={control}
                    name={`values.${index}.color_hex`}
                    render={({ field, fieldState }) => (
                      <FieldInput
                        field={field}
                        fieldState={fieldState}
                        label="Cor (hex)"
                        required={false}
                        maxLength={7}
                      />
                    )}
                  />
                )}
                <Controller
                  control={control}
                  name={`values.${index}.is_active`}
                  render={({ field, fieldState }) => (
                    <FieldSwitch
                      field={field}
                      fieldState={fieldState}
                      heading="Ativo"
                      label={field.value ? 'Sim' : 'Não'}
                    />
                  )}
                />
                <button
                  type="button"
                  aria-label={`Excluir ${getValues(`values.${index}.label`) || 'valor'}`}
                  className="mt-7 flex size-10 items-center justify-center rounded-lg border border-border text-status-error"
                  onClick={() => values.remove(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <Action className="action-outline w-max" onPress={() => values.append(emptyValue())}>
              <Plus size={16} /> Adicionar valor
            </Action>
          </div>

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
