'use client';

import {
  Description,
  FieldError,
  TextField as HeroTextField,
  Label,
  TextArea,
} from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

/**
 * Campo de texto multilinha — mesmo contrato do FieldInput (o chamador envolve isto num
 * <Controller> e repassa `field`/`fieldState`). Ver skill `form-fields`.
 */
export function FieldTextarea<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label,
  description,
  rows = 4,
  required = false,
  maxLength,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <HeroTextField
      name={field.name}
      isRequired={required}
      isInvalid={fieldState.invalid}
      className="form-field"
    >
      <Label>{label}</Label>
      <TextArea
        ref={field.ref}
        value={(field.value ?? '') as string}
        onChange={field.onChange}
        onBlur={field.onBlur}
        rows={rows}
        maxLength={maxLength}
        className="field-input"
      />
      {description && !fieldState.error && <Description>{description}</Description>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </HeroTextField>
  );
}
