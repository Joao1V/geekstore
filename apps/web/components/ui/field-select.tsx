'use client';

import { Description, FieldError, Label, ListBox, Select } from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

import { type FieldSelectOption, renderFieldOptions } from './field-options';

export type { FieldSelectOption } from './field-options';

/**
 * Campo de seleção — a parte apresentacional, mesmo contrato do FieldInput (o chamador envolve
 * isto num <Controller> e repassa `field`/`fieldState`). O Select do HeroUI usa `value`/`onChange`
 * direto (não `selectedKey`/`onSelectionChange`, que está deprecated), o que casa 1:1 com
 * `field.value`/`field.onChange` sem tradução nenhuma.
 */
export function FieldSelect<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label,
  description,
  options,
  placeholder = 'Selecione…',
  required = true,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  options: FieldSelectOption[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Select<FieldSelectOption>
      name={field.name}
      value={(field.value ?? null) as string | null}
      onChange={field.onChange}
      onBlur={field.onBlur}
      isRequired={required}
      isInvalid={fieldState.invalid}
      placeholder={placeholder}
      className="form-field"
    >
      <Label>{label}</Label>
      <Select.Trigger ref={field.ref} className="field-input">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="rounded-md">
        <ListBox>{renderFieldOptions(options)}</ListBox>
      </Select.Popover>
      {description && !fieldState.error && <Description>{description}</Description>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </Select>
  );
}
