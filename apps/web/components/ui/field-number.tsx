'use client';

import { Description, FieldError, Label, NumberField } from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

/**
 * Campo numérico — mesmo contrato do FieldInput. O valor do formulário é `number | null`
 * (campo vazio = `null`). Para reais, passe `formatOptions={{ style: 'currency', currency: 'BRL' }}`
 * e converta com `toCents` só ao enviar. Ver skill `form-fields`.
 */
export function FieldNumber<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label,
  description,
  required = true,
  minValue,
  maxValue,
  step,
  formatOptions,
  hideLabel = false,
  isDisabled = false,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  step?: number;
  formatOptions?: Intl.NumberFormatOptions;
  /** Esconde o rótulo visualmente (célula de tabela); continua para leitores de tela. */
  hideLabel?: boolean;
  isDisabled?: boolean;
}) {
  const value = typeof field.value === 'number' ? field.value : Number.NaN;
  return (
    <NumberField
      name={field.name}
      value={value}
      onChange={(next) => field.onChange(Number.isNaN(next) ? null : next)}
      onBlur={field.onBlur}
      isRequired={required}
      isInvalid={fieldState.invalid}
      isDisabled={isDisabled}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      formatOptions={formatOptions}
      isWheelDisabled
      className="form-field"
    >
      <Label className={hideLabel ? 'sr-only' : undefined}>{label}</Label>
      {/* A caixa (borda, fundo, foco) é o Group; o Input interno segue sem borda, como no HeroUI. */}
      <NumberField.Group className="field-input p-0!">
        <NumberField.Input ref={field.ref} />
      </NumberField.Group>
      {description && !fieldState.error && <Description>{description}</Description>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </NumberField>
  );
}
