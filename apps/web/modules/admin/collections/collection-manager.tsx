'use client';

import type { Collection } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { ListOrdered, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCan } from '../lib/use-can';
import { useDeleteCollection } from '../services/catalog/mutations';
import { collectionsQueryOptions } from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { CollectionForm, type CollectionFormTarget } from './collection-form';
import { CollectionProducts } from './collection-products';

const ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-lg border border-border bg-surface';

export function CollectionManager() {
  const canWrite = useCan('catalog:write');
  const { data, isPending, error } = useQuery(collectionsQueryOptions());
  const deleteCollection = useDeleteCollection();
  const [formTarget, setFormTarget] = useState<CollectionFormTarget | null>(null);
  const [managing, setManaging] = useState<Collection | null>(null);
  const [toDelete, setToDelete] = useState<Collection | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteError('');
    try {
      await deleteCollection.mutateAsync(toDelete.collection_id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  const rows = [...(data ?? [])].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, 'pt-BR')
  );

  return (
    <>
      <PageHeader
        title="Coleções"
        actions={
          canWrite && (
            <Action onPress={() => setFormTarget({})}>
              <Plus size={17} /> Nova coleção
            </Action>
          )
        }
      />
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Coleção</Th>
            <Th>Tipo</Th>
            <Th>Posição</Th>
            <Th align="right">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={4}>Carregando…</EmptyRow>}
          {rows.map((collection) => (
            <tr key={collection.collection_id}>
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <strong>{collection.name}</strong>
                  {collection.featured && (
                    <Badge tone="warning">
                      <Star size={11} className="mr-1" /> Destaque
                    </Badge>
                  )}
                </span>
                <span className="muted text-xs">/{collection.slug}</span>
              </Td>
              <Td>
                <Badge tone={collection.kind === 'curated' ? 'info' : 'neutral'}>
                  {collection.kind === 'curated' ? 'Curadoria' : 'Franquia'}
                </Badge>
              </Td>
              <Td>{collection.position}</Td>
              <Td align="right">
                <span className="inline-flex gap-2">
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label={`Produtos de ${collection.name}`}
                    title="Escolher e ordenar produtos"
                    onClick={() => setManaging(collection)}
                    disabled={!canWrite}
                  >
                    <ListOrdered size={16} />
                  </button>
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Editar ${collection.name}`}
                        onClick={() => setFormTarget({ collection })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className={`${ICON_BUTTON} text-status-error`}
                        aria-label={`Excluir ${collection.name}`}
                        onClick={() => {
                          setDeleteError('');
                          setToDelete(collection);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </span>
              </Td>
            </tr>
          ))}
          {data && !rows.length && <EmptyRow colSpan={4}>Nenhuma coleção ainda.</EmptyRow>}
        </tbody>
      </AdminTable>
      <CollectionForm target={formTarget} onClose={() => setFormTarget(null)} />
      <CollectionProducts collection={managing} onClose={() => setManaging(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir coleção"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        isPending={deleteCollection.isPending}
        error={deleteError}
      >
        Excluir <strong>{toDelete?.name}</strong>? Os produtos não são apagados, só saem da coleção.
      </ConfirmDialog>
    </>
  );
}
