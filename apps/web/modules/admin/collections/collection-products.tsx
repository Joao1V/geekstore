'use client';

import type { Collection, Product } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Action, Dialog } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useSetCollectionProducts } from '../services/catalog/mutations';
import {
  collectionProductsQueryOptions,
  productListQueryOptions,
} from '../services/catalog/queries';
import { SearchBox } from '../ui/search-box';

const MIN_SEARCH_LENGTH = 2;
const SEARCH_PAGE_SIZE = 8;
const ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-lg border border-border disabled:opacity-40';

type Item = Pick<Product, 'product_id' | 'name'>;

function Editor({
  collection,
  initial,
  onClose,
}: {
  collection: Collection;
  initial: Item[];
  onClose: () => void;
}) {
  const setProducts = useSetCollectionProducts();
  const [items, setItems] = useState<Item[]>(initial);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const search = useQuery({
    ...productListQueryOptions({ q, page_size: SEARCH_PAGE_SIZE, status: 'active' }),
    enabled: q.length >= MIN_SEARCH_LENGTH,
  });

  const move = (from: number, to: number) =>
    setItems((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (!item) return current;
      next.splice(to, 0, item);
      return next;
    });

  const save = async () => {
    setError('');
    try {
      await setProducts.mutateAsync({
        collection_id: collection.collection_id,
        body: { product_ids: items.map((item) => item.product_id) },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const chosen = new Set(items.map((item) => item.product_id));
  const results = (search.data?.data ?? []).filter((product) => !chosen.has(product.product_id));

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <SearchBox label="Adicionar produto (busque pelo nome)" initialValue={q} onSearch={setQ} />
        {results.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {results.map((product) => (
              <li
                key={product.product_id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm">{product.name}</span>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Adicionar ${product.name}`}
                  onClick={() => setItems((current) => [...current, product])}
                >
                  <Plus size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {search.isSuccess && !results.length && (
          <p className="muted text-sm">Nenhum produto ativo novo para esta busca.</p>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-extrabold">Produtos na coleção ({items.length})</p>
        {!items.length && <p className="muted text-sm">Nenhum produto ainda.</p>}
        <ol className="grid gap-2">
          {items.map((item, index) => (
            <li
              key={item.product_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-3 py-2"
            >
              <span className="text-sm">
                <span className="muted mr-2 text-xs">{index + 1}.</span>
                {item.name}
              </span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label="Mover para cima"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label="Mover para baixo"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className={`${ICON_BUTTON} text-status-error`}
                  aria-label={`Remover ${item.name}`}
                  onClick={() =>
                    setItems((current) => current.filter((c) => c.product_id !== item.product_id))
                  }
                >
                  <X size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>
      {error && (
        <p className="error m-0" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Action className="action-outline" onPress={onClose}>
          Cancelar
        </Action>
        <Action onPress={save} disabled={setProducts.isPending}>
          {setProducts.isPending ? 'Salvando…' : 'Salvar ordem e produtos'}
        </Action>
      </div>
    </div>
  );
}

export function CollectionProducts({
  collection,
  onClose,
}: {
  collection: Collection | null;
  onClose: () => void;
}) {
  const current = useQuery({
    ...collectionProductsQueryOptions(collection?.collection_id ?? ''),
    enabled: collection !== null,
    // O editor guarda a lista localmente: não deixe um refetch de fundo trocar os dados dele.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });

  return (
    <Dialog
      open={collection !== null}
      onChange={(open) => !open && onClose()}
      title={collection ? `Produtos: ${collection.name}` : 'Produtos'}
      size="lg"
    >
      {collection && current.isPending && <p className="muted">Carregando…</p>}
      {collection && current.isError && (
        <p className="error" role="alert">
          {getErrorMessage(current.error)}
        </p>
      )}
      {collection && current.data && (
        <Editor collection={collection} initial={current.data} onClose={onClose} />
      )}
    </Dialog>
  );
}
