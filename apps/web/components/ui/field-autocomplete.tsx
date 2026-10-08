'use client';

import {
  ComboBox,
  Description,
  EmptyState,
  FieldError,
  Input,
  Label,
  ListBox,
} from '@heroui/react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

import { type FieldSelectOption, OptionImage, renderFieldOptions } from './field-options';

/**
 * Seleção única digitável: escreve-se no próprio campo e a lista filtra conforme o texto (o
 * `ComboBox` do HeroUI v3, equivalente ao Autocomplete do v2). Mesmo contrato do FieldSelect (o
 * chamador envolve isto num <Controller> e repassa `field`/`fieldState`); o valor do formulário é
 * `string | null`. Apagar o texto limpa a seleção (`null`).
 *
 * O filtro e o texto mostrado no campo depois de escolher vêm do `textValue` da opção (por padrão o
 * `label`), então use `textValue` para incluir o contexto que deve ser pesquisável (ex.: o caminho
 * "Jogos › Jogos de Tabuleiro") sem poluir o `label` exibido na lista. `group` agrupa sob cabeçalhos.
 */
export function FieldAutocomplete<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label,
  description,
  options,
  placeholder = 'Digite para buscar…',
  emptyText = 'Nenhum resultado',
  required = true,
  leadingImage,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label: string;
  description?: string;
  options: FieldSelectOption[];
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  /** Imagem da opção escolhida, mostrada dentro do campo antes do texto (`undefined` = sem espaço). */
  leadingImage?: string | null;
}) {
  return (
    <ComboBox
      name={field.name}
      selectedKey={(field.value ?? null) as string | null}
      onSelectionChange={(key) => field.onChange(key === null ? null : String(key))}
      onBlur={field.onBlur}
      isRequired={required}
      isInvalid={fieldState.invalid}
      allowsEmptyCollection
      className="form-field"
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup className="relative w-full">
        {/* `pe-8!` reserva o espaço da seta (o padding do field-input, sozinho, a deixaria por cima do texto). */}
        {leadingImage !== undefined && (
          <OptionImage
            src={leadingImage}
            className="pointer-events-none absolute top-1/2 left-2.5 z-10 mr-0 -translate-y-1/2"
          />
        )}
        <Input
          ref={field.ref}
          placeholder={placeholder}
          className={`field-input pe-8! ${leadingImage ? 'ps-11!' : ''}`}
        />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover className="rounded-md">
        <ListBox renderEmptyState={() => <EmptyState>{emptyText}</EmptyState>}>
          {renderFieldOptions(options)}
        </ListBox>
      </ComboBox.Popover>
      {description && !fieldState.error && <Description>{description}</Description>}
      <FieldError>{fieldState.error?.message}</FieldError>
    </ComboBox>
  );
}
