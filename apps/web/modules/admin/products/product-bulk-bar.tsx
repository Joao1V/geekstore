'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FolderInput, X } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action } from '@/components/ui';
import { CategoryAutocomplete } from '../categories/category-autocomplete';
import { formatInteger } from '../lib/format';

const schema = z.object({ category_id: z.string().min(1, 'Escolha a categoria de destino') });

/**
 * Barra que aparece quando há produtos marcados na lista: mover todos para uma categoria. Com a
 * página inteira marcada, oferece marcar TODOS os resultados do filtro (não só os 20 da página).
 */
export function ProductBulkBar({
  selectedCount,
  total,
  pageFullySelected,
  allMatching,
  isMoving,
  error,
  onSelectAllMatching,
  onClear,
  onMove,
}: {
  selectedCount: number;
  total: number;
  pageFullySelected: boolean;
  allMatching: boolean;
  isMoving: boolean;
  error: string;
  onSelectAllMatching: () => void;
  onClear: () => void;
  onMove: (categoryId: string) => void;
}) {
  const { control, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { category_id: '' },
  });
  const count = allMatching ? total : selectedCount;

  return (
    <section
      aria-label="Ações em massa"
      className="surface sticky top-3 z-20 mb-4 grid gap-3 border-geek-yellow p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <strong>
          {formatInteger(count)} {count === 1 ? 'produto selecionado' : 'produtos selecionados'}
        </strong>
        {pageFullySelected && !allMatching && total > selectedCount && (
          <button type="button" className="font-extrabold underline" onClick={onSelectAllMatching}>
            Selecionar todos os {formatInteger(total)} resultados
          </button>
        )}
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 font-extrabold underline"
          onClick={onClear}
        >
          <X size={14} /> Limpar seleção
        </button>
      </div>
      <form
        onSubmit={handleSubmit((values) => onMove(values.category_id))}
        className="grid grid-cols-[1fr_auto] items-end gap-3 max-md:grid-cols-1"
        noValidate
      >
        <Controller
          control={control}
          name="category_id"
          render={({ field, fieldState }) => (
            <CategoryAutocomplete
              field={field}
              fieldState={fieldState}
              label="Mover para a categoria"
              placeholder="Digite para buscar a categoria de destino…"
            />
          )}
        />
        <Action type="submit" disabled={isMoving}>
          <FolderInput size={17} /> {isMoving ? 'Movendo…' : `Mover ${formatInteger(count)}`}
        </Action>
      </form>
      {error && (
        <p className="error m-0" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
