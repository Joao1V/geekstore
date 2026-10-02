'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

import { FieldAutocomplete } from '@/components/ui';
import { brandsQueryOptions } from '../services/catalog/queries';

/** Seletor de marca digitável. Marca inativa só aparece se for a já escolhida no produto. */
export function BrandAutocomplete<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label = 'Marca',
  required = false,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label?: string;
  required?: boolean;
}) {
  const { data: brands } = useQuery(brandsQueryOptions());
  const options = useMemo(
    () =>
      (brands ?? [])
        .filter((brand) => brand.is_active || brand.brand_id === field.value)
        .map((brand) => ({ value: brand.brand_id, label: brand.name })),
    [brands, field.value]
  );
  return (
    <FieldAutocomplete
      field={field}
      fieldState={fieldState}
      label={label}
      description="Não achou? Cadastre em Marcas."
      placeholder="Digite para buscar uma marca…"
      emptyText="Nenhuma marca com esse nome"
      options={options}
      required={required}
    />
  );
}
