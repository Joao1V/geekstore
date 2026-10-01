'use client';

import { Plus, Trash2 } from 'lucide-react';
import { type Control, Controller, useFieldArray } from 'react-hook-form';

import { Action, FieldInput, FieldNumber, FieldSelect } from '@/components/ui';
import { SKU_STATUS_OPTIONS } from './labels';
import type { ProductFormValues } from './product-form-schema';

const BRL = { style: 'currency', currency: 'BRL' } as const;

function AttributeRows({ control, index }: { control: Control<ProductFormValues>; index: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `skus.${index}.attributes` });
  return (
    <div className="grid gap-3">
      <p className="text-sm font-extrabold">Atributos (tamanho, cor, edição…)</p>
      {fields.map((attribute, attributeIndex) => (
        <div key={attribute.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
          <Controller
            control={control}
            name={`skus.${index}.attributes.${attributeIndex}.key`}
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Atributo" required={false} />
            )}
          />
          <Controller
            control={control}
            name={`skus.${index}.attributes.${attributeIndex}.value`}
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Valor" required={false} />
            )}
          />
          <button
            type="button"
            aria-label="Remover atributo"
            className="mt-7 flex size-10 items-center justify-center rounded-lg border border-border"
            onClick={() => remove(attributeIndex)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Action className="action-outline w-max" onPress={() => append({ key: '', value: '' })}>
        <Plus size={16} /> Adicionar atributo
      </Action>
    </div>
  );
}

export function SkuFields({
  control,
  index,
  isExisting,
  canRemove,
  onRemove,
}: {
  control: Control<ProductFormValues>;
  index: number;
  isExisting: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <fieldset className="grid gap-5 rounded-2xl border border-border p-5 max-md:p-4">
      <legend className="flex items-center gap-3 px-2 text-sm font-extrabold">
        SKU {index + 1}
        {canRemove && (
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-extrabold text-status-error"
            onClick={onRemove}
          >
            <Trash2 size={14} /> Remover
          </button>
        )}
      </legend>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Controller
          control={control}
          name={`skus.${index}.code`}
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Código do SKU"
              description={isExisting ? 'O código é imutável.' : 'Ex.: FUN-POP-1248'}
              disabled={isExisting}
            />
          )}
        />
        <Controller
          control={control}
          name={`skus.${index}.ean`}
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="EAN/GTIN"
              required={false}
              inputMode="numeric"
              maxLength={14}
            />
          )}
        />
        <Controller
          control={control}
          name={`skus.${index}.ncm`}
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="NCM"
              required={false}
              inputMode="numeric"
              maxLength={8}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-5 gap-4 max-tablet:grid-cols-3 max-md:grid-cols-2">
        <Controller
          control={control}
          name={`skus.${index}.weight_g`}
          render={({ field, fieldState }) => (
            <FieldNumber
              field={field}
              fieldState={fieldState}
              label="Peso (g)"
              required={false}
              minValue={0}
            />
          )}
        />
        <Controller
          control={control}
          name={`skus.${index}.length_mm`}
          render={({ field, fieldState }) => (
            <FieldNumber
              field={field}
              fieldState={fieldState}
              label="Comprimento (mm)"
              required={false}
              minValue={0}
            />
          )}
        />
        <Controller
          control={control}
          name={`skus.${index}.width_mm`}
          render={({ field, fieldState }) => (
            <FieldNumber
              field={field}
              fieldState={fieldState}
              label="Largura (mm)"
              required={false}
              minValue={0}
            />
          )}
        />
        <Controller
          control={control}
          name={`skus.${index}.height_mm`}
          render={({ field, fieldState }) => (
            <FieldNumber
              field={field}
              fieldState={fieldState}
              label="Altura (mm)"
              required={false}
              minValue={0}
            />
          )}
        />
        <Controller
          control={control}
          name={`skus.${index}.cost`}
          render={({ field, fieldState }) => (
            <FieldNumber
              field={field}
              fieldState={fieldState}
              label="Custo"
              required={false}
              minValue={0}
              formatOptions={BRL}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Controller
          control={control}
          name={`skus.${index}.status`}
          render={({ field, fieldState }) => (
            <FieldSelect
              field={field}
              fieldState={fieldState}
              label="Situação do SKU"
              options={SKU_STATUS_OPTIONS}
            />
          )}
        />
      </div>
      <AttributeRows control={control} index={index} />
    </fieldset>
  );
}
