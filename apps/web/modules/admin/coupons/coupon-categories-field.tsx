'use client';

import { CloseButton } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { CategoryAutocomplete } from '../categories/category-autocomplete';
import { categoryLabels } from '../lib/category-tree';
import { categoriesQueryOptions } from '../services/catalog/queries';

/**
 * Categorias em que o cupom vale: etiquetas com × e um campo de busca para acrescentar. Vazio = o
 * carrinho todo. O valor é a lista de `category_id`, controlada pelo formulário do cupom.
 */
export function CouponCategoriesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: categories } = useQuery(categoriesQueryOptions());
  const labels = useMemo(() => categoryLabels(categories ?? []), [categories]);
  const { control } = useForm<{ add: string | null }>({ defaultValues: { add: null } });
  // Recria o campo de busca a cada categoria acrescentada: o texto digitado não fica sobrando.
  const [resetKey, setResetKey] = useState(0);
  const isOptionAllowed = useCallback(
    (node: { category: { category_id: string } }) => !value.includes(node.category.category_id),
    [value]
  );

  const labelOf = (id: string): string => {
    const label = labels.get(id);
    if (!label) return 'Categoria';
    return label.parent ? `${label.parent} › ${label.name}` : label.name;
  };

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-md bg-surface-secondary py-1 pr-1 pl-3 text-xs font-bold"
            >
              {labelOf(id)}
              <CloseButton
                aria-label={`Tirar ${labelOf(id)}`}
                className="size-5 min-w-5 hover:text-status-error"
                onPress={() => onChange(value.filter((other) => other !== id))}
              />
            </li>
          ))}
        </ul>
      )}
      <Controller
        key={resetKey}
        control={control}
        name="add"
        render={({ field, fieldState }) => (
          <CategoryAutocomplete
            field={{
              ...field,
              value: null,
              onChange: (next) => {
                if (typeof next === 'string' && next) {
                  onChange([...value, next]);
                  setResetKey((key) => key + 1);
                }
              },
            }}
            fieldState={fieldState}
            label="Vale só para as categorias"
            description="Em branco: vale para o carrinho todo. Vale também nas subcategorias."
            placeholder="Digite para buscar uma categoria…"
            required={false}
            isOptionAllowed={isOptionAllowed}
          />
        )}
      />
    </div>
  );
}
