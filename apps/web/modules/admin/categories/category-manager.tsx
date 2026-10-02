'use client';

import type { Category } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Action } from '@/components/ui';
import {
  buildCategoryTree,
  type CategoryNode,
  flattenTree,
  MAX_CATEGORY_DEPTH,
} from '../lib/category-tree';
import { getErrorMessage } from '../lib/errors';
import { formatInteger } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useDeleteCategory } from '../services/catalog/mutations';
import { categoriesQueryOptions } from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { CategoryForm, type CategoryFormTarget } from './category-form';

const ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-lg border border-border bg-surface hover:border-ink disabled:opacity-40';
const INDENT_REM = 1.75;

/** Produtos da pasta e de todas as subpastas. */
function totalProducts(node: CategoryNode): number {
  return (
    node.category.product_count +
    node.children.reduce((sum, child) => sum + totalProducts(child), 0)
  );
}

/** As categorias como pastas: abrem e fecham, mostram quantos produtos há dentro e levam à lista. */
export function CategoryManager() {
  const canWrite = useCan('catalog:write');
  const { data, isPending, error } = useQuery(categoriesQueryOptions());
  const deleteCategory = useDeleteCategory();
  const [formTarget, setFormTarget] = useState<CategoryFormTarget | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const tree = useMemo(() => buildCategoryTree(data ?? []), [data]);
  const folderIds = useMemo(
    () =>
      flattenTree(tree)
        .filter((node) => node.children.length > 0)
        .map((node) => node.category.category_id),
    [tree]
  );
  const allOpen = folderIds.length > 0 && folderIds.every((id) => open.has(id));

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const renderNode = (node: CategoryNode) => {
    const { category, depth, children } = node;
    const isFolder = children.length > 0;
    const isOpen = open.has(category.category_id);
    const total = totalProducts(node);
    const FolderIcon = isFolder && isOpen ? FolderOpen : Folder;

    return (
      <li key={category.category_id}>
        <div
          className="group flex items-center gap-2 border-b border-border px-3 py-2 hover:bg-surface-secondary/60"
          style={{ paddingLeft: `${0.75 + (depth - 1) * INDENT_REM}rem` }}
        >
          <button
            type="button"
            aria-label={isOpen ? `Fechar ${category.name}` : `Abrir ${category.name}`}
            aria-expanded={isFolder ? isOpen : undefined}
            disabled={!isFolder}
            className="flex size-7 shrink-0 items-center justify-center rounded text-muted disabled:opacity-0"
            onClick={() => toggle(category.category_id)}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <FolderIcon
            size={20}
            className={isFolder ? 'shrink-0 text-geek-yellow' : 'shrink-0 text-muted'}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={`/admin/produtos/?category_id=${category.category_id}`}
              className="truncate font-extrabold hover:underline"
              title="Ver os produtos desta pasta"
            >
              {category.name}
            </Link>
            {category.featured && (
              <Badge tone="warning">
                <Star size={11} className="mr-1" /> Destaque
              </Badge>
            )}
            <span className="muted font-mono text-2xs max-md:hidden">/{category.slug}</span>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-extrabold tabular-nums"
            title={
              isFolder
                ? `${formatInteger(category.product_count)} direto aqui + subpastas`
                : 'Produtos nesta categoria'
            }
          >
            <Package size={13} aria-hidden="true" />
            {formatInteger(total)}
          </span>
          {canWrite && (
            <div className="flex shrink-0 gap-1.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label={`Nova subpasta em ${category.name}`}
                title="Nova subpasta"
                disabled={depth >= MAX_CATEGORY_DEPTH}
                onClick={() => {
                  setOpen((current) => new Set(current).add(category.category_id));
                  setFormTarget({ parentId: category.category_id });
                }}
              >
                <FolderPlus size={15} />
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                aria-label={`Editar ${category.name}`}
                onClick={() => setFormTarget({ category })}
              >
                <Pencil size={15} />
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
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        {isFolder && isOpen && <ul>{children.map(renderNode)}</ul>}
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Categorias"
        actions={
          canWrite && (
            <Action onPress={() => setFormTarget({})}>
              <Plus size={17} /> Nova pasta
            </Action>
          )
        }
      />
      <p className="muted mb-4 max-w-3xl text-sm">
        Organize como pastas: até {MAX_CATEGORY_DEPTH} níveis. O número mostra quantos produtos há
        na pasta e nas subpastas; clique no nome para ver a lista.
      </p>
      {folderIds.length > 0 && (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-extrabold hover:border-ink"
            onClick={() => setOpen(allOpen ? new Set() : new Set(folderIds))}
          >
            {allOpen ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
            {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      {isPending && <p className="muted">Carregando…</p>}
      {data && !tree.length && (
        <p className="surface p-8 text-center muted">Nenhuma categoria ainda.</p>
      )}
      {tree.length > 0 && <ul className="surface overflow-hidden">{tree.map(renderNode)}</ul>}
      <CategoryForm target={formTarget} tree={tree} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir pasta"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        isPending={deleteCategory.isPending}
        error={deleteError}
      >
        Excluir <strong>{toDelete?.name}</strong>? Pastas com subpastas ou produtos não podem ser
        excluídas.
      </ConfirmDialog>
    </>
  );
}
