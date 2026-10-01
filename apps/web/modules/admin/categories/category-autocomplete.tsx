'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';

import { FieldAutocomplete, type FieldSelectOption } from '@/components/ui';
import { buildCategoryTree, type CategoryNode, groupedCategoryOptions } from '../lib/category-tree';
import { categoriesQueryOptions } from '../services/catalog/queries';

/**
 * Seletor de categoria digitável (filtra conforme o texto), agrupado pela categoria raiz. Digitar o
 * nome de uma raiz mostra tudo dentro dela. Apagar o texto limpa a seleção (`null`), útil em filtros. Busca a árvore sozinho (o cache do
 * React Query compartilha a requisição entre telas), então basta usar dentro de um <Controller>.
 * - `isOptionAllowed`: esconde categorias que não podem ser escolhidas (ex.: o pai de uma categoria
 *   não pode ser ela mesma nem uma descendente). Passe uma função estável (`useCallback`/`useMemo`).
 * - `leadingOptions`: opções soltas no topo, fora dos grupos (ex.: "Nenhuma (categoria raiz)").
 */
export function CategoryAutocomplete<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  fieldState,
  label = 'Categoria',
  description,
  placeholder = 'Digite para buscar uma categoria…',
  required = true,
  isOptionAllowed,
  leadingOptions,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  fieldState: ControllerFieldState;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  isOptionAllowed?: (node: CategoryNode) => boolean;
  leadingOptions?: FieldSelectOption[];
}) {
  const { data: categories } = useQuery(categoriesQueryOptions());
  const options = useMemo(
    () => [
      ...(leadingOptions ?? []),
      ...groupedCategoryOptions(buildCategoryTree(categories ?? []), isOptionAllowed),
    ],
    [categories, isOptionAllowed, leadingOptions]
  );

  return (
    <FieldAutocomplete
      field={field}
      fieldState={fieldState}
      label={label}
      description={description}
      placeholder={placeholder}
      emptyText="Nenhuma categoria encontrada"
      required={required}
      options={options}
    />
  );
}
