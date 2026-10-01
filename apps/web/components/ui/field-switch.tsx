'use client';

import { Switch } from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

/**
 * Interruptor booleano — mesmo contrato do FieldInput. Com `heading`, ocupa a mesma estrutura de um
 * campo (título + caixa de 2,5rem), para alinhar com o input vizinho numa grade. Ver skill `form-fields`.
 */
export function FieldSwitch<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label,
  heading,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  heading?: string;
}) {
  const control = (
    <Switch
      name={field.name}
      isSelected={Boolean(field.value)}
      onChange={field.onChange}
      isInvalid={fieldState.invalid}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <span className="text-sm font-extrabold">{label}</span>
      </Switch.Content>
    </Switch>
  );
  if (!heading) return control;
  return (
    <div className="form-field">
      <span className="text-sm font-medium">{heading}</span>
      <div className="flex min-h-10 items-center">{control}</div>
    </div>
  );
}
