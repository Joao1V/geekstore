'use client';

import type { Attribute, CategoryAttribute } from '@geekstore/shared';
import { Trash2 } from 'lucide-react';
import { type Control, Controller } from 'react-hook-form';

import { FieldInput, FieldNumber, FieldSelect } from '@/components/ui';
import { SKU_STATUS_OPTIONS } from './labels';
import { NO_VALUE, type ProductFormValues } from './product-form-schema';

const BRL = { style: 'currency', currency: 'BRL' } as const;

function AttributeFields({
  control,
  index,
  rules,
  definitions,
}: {
  control: Control<ProductFormValues>;
  index: number;
  rules: CategoryAttribute[];
  definitions: Attribute[];
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm font-extrabold">Variação</p>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {rules.map((rule) => {
          const values =
            definitions.find((d) => d.attribute_id === rule.attribute_id)?.values ?? [];
          const options = [
            ...(rule.is_required ? [] : [{ value: NO_VALUE, label: 'Nenhum' }]),
            ...values.map((value) => ({ value: value.code, label: value.label })),
          ];
          return (
            <Controller
              key={rule.attribute_id}
              control={control}
              name={`skus.${index}.attributes.${rule.code}`}
              render={({ field, fieldState }) => (
                <FieldSelect
                  field={{ ...field, value: field.value || (rule.is_required ? '' : NO_VALUE) }}
                  fieldState={fieldState}
                  label={rule.name}
                  required={rule.is_required}
                  options={options}
                />
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SkuFields({
  control,
  index,
  isExisting,
  canRemove,
  onRemove,
  rules,
  definitions,
}: {
  control: Control<ProductFormValues>;
  index: number;
  rules: CategoryAttribute[];
  definitions: Attribute[];
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
      {rules.length > 0 && (
        <AttributeFields control={control} index={index} rules={rules} definitions={definitions} />
      )}
    </fieldset>
  );
}
