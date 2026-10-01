'use client';

import type { Category } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Action } from '@/components/ui';
import { buildCategoryTree, flattenTree, MAX_CATEGORY_DEPTH } from '../lib/category-tree';
import { getErrorMessage } from '../lib/errors';
import { useCan } from '../lib/use-can';
import { useDeleteCategory } from '../services/catalog/mutations';
import { categoriesQueryOptions } from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { CategoryForm, type CategoryFormTarget } from './category-form';

const ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-lg border border-border bg-surface disabled:opacity-40';
const INDENT_REM = 1.75;

export function CategoryManager() {
  const canWrite = useCan('catalog:write');
  const { data, isPending, error } = useQuery(categoriesQueryOptions());
  const deleteCategory = useDeleteCategory();
  const [formTarget, setFormTarget] = useState<CategoryFormTarget | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const tree = useMemo(() => buildCategoryTree(data ?? []), [data]);
  const rows = useMemo(() => flattenTree(tree), [tree]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteError('');
    try {
      await deleteCategory.mutateAsync(toDelete.category_id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Categorias"
        actions={
          canWrite && (
            <Action onPress={() => setFormTarget({})}>
              <Plus size={17} /> Nova categoria
            </Action>
          )
        }
      />
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      {isPending && <p className="muted">Carregando…</p>}
      {data && !rows.length && (
        <p className="surface p-8 text-center muted">Nenhuma categoria ainda.</p>
      )}
      {rows.length > 0 && (
        <ul className="surface divide-y divide-border">
          {rows.map(({ category, depth }) => (
            <li
              key={category.category_id}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ paddingLeft: `${1 + (depth - 1) * INDENT_REM}rem` }}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <strong className="truncate">{category.name}</strong>
                <span className="muted text-xs">/{category.slug}</span>
                {category.featured && (
                  <Badge tone="warning">
                    <Star size={11} className="mr-1" /> Destaque
                  </Badge>
                )}
                <span className="muted text-xs">posição {category.position}</span>
              </div>
              {canWrite && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label={`Nova subcategoria de ${category.name}`}
                    title="Nova subcategoria"
                    disabled={depth >= MAX_CATEGORY_DEPTH}
                    onClick={() => setFormTarget({ parentId: category.category_id })}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label={`Editar ${category.name}`}
                    onClick={() => setFormTarget({ category })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${ICON_BUTTON} text-status-error`}
                    aria-label={`Excluir ${category.name}`}
                    onClick={() => {
                      setDeleteError('');
                      setToDelete(category);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <CategoryForm target={formTarget} tree={tree} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir categoria"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        isPending={deleteCategory.isPending}
        error={deleteError}
      >
        Excluir <strong>{toDelete?.name}</strong>? Categorias com subcategorias ou produtos podem
        não poder ser excluídas.
      </ConfirmDialog>
    </>
  );
}
