'use client';

import { Description, FieldError, TextField as HeroTextField, Input, Label } from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

/**
 * Data e hora (`datetime-local`) — mesmo contrato do FieldInput. O valor do formulário é o texto do
 * navegador (`2026-12-31T23:59`, no fuso local), vazio quando não há data. Quem usa converte de/para
 * ISO UTC ao carregar e ao enviar. Ver skill `form-fields`.
 */
export function FieldDate<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  field,
  fieldState,
  label,
  description,
  required = false,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  required?: boolean;
}) {
  return (
    <HeroTextField
      name={field.name}
      isRequired={required}
      isInvalid={fieldState.invalid}
      className="form-field"
    >
      <Label>{label}</Label>
      <Input
        ref={field.ref}
        type="datetime-local"
        value={(field.value ?? '') as string}
        onChange={field.onChange}
        onBlur={field.onBlur}
        className="field-input"
      />
      {description && !fieldState.error && <Description>{description}</Description>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </HeroTextField>
  );
}
