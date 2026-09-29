'use client';

import { Description, FieldError, TextField as HeroTextField, Input, Label } from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

/**
 * A parte apresentacional de todo campo de formulário do sistema — o chamador envolve isto
 * num <Controller> do react-hook-form e repassa `field`/`fieldState` do render prop; Field só
 * deriva isInvalid/errorMessage de `fieldState`, pra nenhum form repetir essa lógica manualmente.
 * Ver skill `form-fields`.
 */
export function Field<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  field,
  fieldState,
  label,
  description,
  type = 'text',
  required = true,
  autoComplete,
  pattern,
  minLength,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  required?: boolean;
  autoComplete?: string;
  pattern?: string;
  minLength?: number;
}) {
  return (
    <HeroTextField
      name={field.name}
      type={type}
      isRequired={required}
      isInvalid={fieldState.invalid}
      className="form-field"
    >
      <Label>{label}</Label>
      <Input
        ref={field.ref}
        value={(field.value ?? '') as string}
        onChange={field.onChange}
        onBlur={field.onBlur}
        autoComplete={autoComplete}
        pattern={pattern}
        minLength={minLength}
        className="field-input"
      />
      {description && !fieldState.error && <Description>{description}</Description>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </HeroTextField>
  );
}
