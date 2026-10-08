'use client';

import type { ProductDetail } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FieldAutocomplete } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCan } from '../lib/use-can';
import { useSetProductCollections } from '../services/catalog/mutations';
import { collectionsQueryOptions } from '../services/catalog/queries';

const KIND_GROUPS = { franchise: 'Franquias', curated: 'Curadas' } as const;

/** Coleções do produto: etiquetas com × para tirar e um campo de busca para adicionar. Salva a cada clique. */
export function ProductCollectionsCard({ product }: { product: ProductDetail }) {
  const canWrite = useCan('catalog:write');
  const { data: collections } = useQuery(collectionsQueryOptions());
  const setCollections = useSetProductCollections();
  const [error, setError] = useState('');
  // Recria o campo de busca depois de cada alteração: o texto digitado não fica sobrando.
  const [resetKey, setResetKey] = useState(0);
  const { control } = useForm<{ add: string | null }>({ defaultValues: { add: null } });

  const linkedIds = product.collection_ids;
  const linked = (collections ?? []).filter((c) => linkedIds.includes(c.collection_id));
  const options = useMemo(
    () =>
      (collections ?? [])
        .filter((c) => !linkedIds.includes(c.collection_id))
        .map((c) => ({ value: c.collection_id, label: c.name, group: KIND_GROUPS[c.kind] })),
    [collections, linkedIds]
  );

  const save = async (nextIds: string[]) => {
    setError('');
    try {
      await setCollections.mutateAsync({ product_id: product.product_id, collection_ids: nextIds });
      setResetKey((key) => key + 1);
    } catch (failure) {
      setError(getErrorMessage(failure));
    }
  };

  return (
    <section className="surface grid gap-3 p-5" aria-labelledby="product-collections">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="product-collections" className="m-0 text-base font-extrabold">
          Coleções
        </h2>
        <Link href="/admin/colecoes/" className="muted text-xs font-bold underline">
          Gerenciar
        </Link>
      </div>

      {linked.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {linked.map((collection) => (
            <li
              key={collection.collection_id}
              className="inline-flex items-center gap-1 rounded-full bg-surface-secondary py-1 pr-1 pl-3 text-xs font-bold"
            >
              {collection.name}
              {canWrite && (
                <button
                  type="button"
                  aria-label={`Tirar de ${collection.name}`}
                  title="Tirar da coleção"
                  disabled={setCollections.isPending}
                  className="grid size-5 place-items-center rounded-full hover:bg-status-error/15 hover:text-status-error disabled:opacity-50"
                  onClick={() => save(linkedIds.filter((id) => id !== collection.collection_id))}
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted m-0 text-sm">Este produto não está em nenhuma coleção.</p>
      )}

      {canWrite && (
        <Controller
          key={resetKey}
          control={control}
          name="add"
          render={({ field, fieldState }) => (
            <FieldAutocomplete
              field={{
                ...field,
                value: null,
                onChange: (next) => {
                  if (typeof next === 'string' && next) save([...linkedIds, next]);
                },
              }}
              fieldState={fieldState}
              label="Adicionar coleção"
              placeholder="Digite para buscar…"
              emptyText="Nenhuma coleção com esse nome"
              options={options}
              required={false}
            />
          )}
        />
      )}
      {error && (
        <p className="error m-0 text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
