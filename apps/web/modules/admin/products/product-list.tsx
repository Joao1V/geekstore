'use client';

import type { ProductListQuery } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { CategoryAutocomplete } from '../categories/category-autocomplete';
import { categoryLabels } from '../lib/category-tree';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime, formatInteger } from '../lib/format';
import { useCan } from '../lib/use-can';
import { nextSort, useUrlState } from '../lib/use-url-state';
import { useMoveProducts } from '../services/catalog/mutations';
import {
  categoriesQueryOptions,
  productListQueryOptions,
  productSummaryQueryOptions,
} from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { type FilterChip, FilterChips } from '../ui/filter-chips';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { SearchBox } from '../ui/search-box';
import { SortHeader } from '../ui/sort-header';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { Thumbnail } from '../ui/thumbnail';
import { ISSUE_LABELS } from './labels';
import { type ChipId, chipFromParams, extraIssue, paramsFromChip } from './list-filters';
import { ProductBulkBar } from './product-bulk-bar';
import { CategoryCell, PriceCell, SkuCell, StatusCell, StockCell } from './product-cells';

const PAGE_SIZE = 20;
const COLUMNS = 9;

type Filters = { category_id: string | null };

export function ProductList() {
  const canWrite = useCan('catalog:write');
  const { searchParams, setParams, page } = useUrlState();
  const q = searchParams.get('q') ?? '';
  const categoryId = searchParams.get('category_id');
  const sort = searchParams.get('sort') ?? 'updated_at:desc';
  const chip = chipFromParams(searchParams.get('status'), searchParams.get('issue'));
  const extra = extraIssue(searchParams.get('issue'));
  const { status, issue: chipIssue } = paramsFromChip(chip);
  const issue = chipIssue ?? extra;

  const { data: categories } = useQuery(categoriesQueryOptions());
  const { data: summary } = useQuery(productSummaryQueryOptions());
  const { data, isPending, error } = useQuery(
    productListQueryOptions({
      page,
      page_size: PAGE_SIZE,
      sort,
      q: q || undefined,
      status: (status ?? undefined) as ProductListQuery['status'],
      issue: (issue ?? undefined) as ProductListQuery['issue'],
      category_id: categoryId ?? undefined,
    })
  );

  const { control } = useForm<Filters>({ values: { category_id: categoryId } });

  // Seleção para ações em massa: os marcados na página, ou todos os resultados do filtro.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveNotice, setMoveNotice] = useState('');
  const move = useMoveProducts();
  const filterKey = [q, categoryId, chip, extra, page, sort].join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: a seleção vale para UMA tela de resultados; mudou o filtro ou a página, zera
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [filterKey]);
  const rows = data?.data ?? [];
  const pageFullySelected = rows.length > 0 && rows.every((row) => selected.has(row.product_id));
  const selectedCount = allMatching ? (data?.meta.total ?? 0) : selected.size;
  const toggleRow = (id: string) => {
    setAllMatching(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected(pageFullySelected ? new Set() : new Set(rows.map((row) => row.product_id)));
  };
  const runMove = async (targetCategoryId: string) => {
    setMoveError('');
    setMoveNotice('');
    try {
      const body = allMatching
        ? {
            category_id: targetCategoryId,
            filter: {
              q: q || undefined,
              status: (status ?? undefined) as ProductListQuery['status'],
              issue: (issue ?? undefined) as ProductListQuery['issue'],
              category_id: categoryId ?? undefined,
            },
          }
        : { category_id: targetCategoryId, product_ids: [...selected] };
      const result = await move.mutateAsync(body);
      setMoveNotice(
        result.moved === 0
          ? 'Nada mudou: os produtos já estavam nessa categoria.'
          : `${formatInteger(result.moved)} ${result.moved === 1 ? 'produto movido' : 'produtos movidos'}.`
      );
      setSelected(new Set());
      setAllMatching(false);
    } catch (err) {
      setMoveError(getErrorMessage(err));
    }
  };
  const labels = useMemo(() => categoryLabels(categories ?? []), [categories]);

  const chips: FilterChip[] = [
    { id: 'all', label: 'Todos', count: summary?.total },
    { id: 'active', label: 'Ativos', count: summary?.active },
    { id: 'draft', label: 'Rascunhos', count: summary?.draft },
    { id: 'out_of_stock', label: 'Sem estoque', count: summary?.out_of_stock, attention: 'error' },
    { id: 'no_photo', label: 'Sem foto', count: summary?.no_photo, attention: 'warning' },
    ...(summary?.archived
      ? [{ id: 'archived', label: 'Arquivados', count: summary.archived }]
      : []),
  ];
  const hasFilters = Boolean(q || categoryId || chip !== 'all' || extra);

  return (
    <>
      <PageHeader
        title="Produtos"
        crumbs={[{ label: 'Catálogo' }, { label: 'Produtos' }]}
        actions={
          canWrite && (
            <Link href="/admin/produtos/novo/" className="action">
              <Plus size={17} /> Novo produto
            </Link>
          )
        }
      />
      <FilterChips
        label="Filtrar produtos"
        chips={chips}
        active={chip}
        onSelect={(id) => setParams(paramsFromChip(id as ChipId))}
      />
      {extra && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="muted">Filtrando por pendência:</span>
          <Badge tone="warning">{ISSUE_LABELS[extra]}</Badge>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-extrabold underline"
            onClick={() => setParams({ issue: null })}
          >
            <X size={13} /> Limpar
          </button>
        </p>
      )}
      <div className="mb-5 grid grid-cols-[2fr_1fr] items-start gap-4 max-md:grid-cols-1">
        <SearchBox
          label="Buscar por nome ou SKU"
          initialValue={q}
          onSearch={(value) => setParams({ q: value })}
        />
        <Controller
          control={control}
          name="category_id"
          render={({ field, fieldState }) => (
            <CategoryAutocomplete
              field={{ ...field, onChange: (value) => setParams({ category_id: value }) }}
              fieldState={fieldState}
              required={false}
              placeholder="Todas as categorias"
            />
          )}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      {moveNotice && (
        <p className="notice mb-4" role="status">
          {moveNotice}
        </p>
      )}
      {canWrite && selectedCount > 0 && (
        <ProductBulkBar
          selectedCount={selectedCount}
          total={data?.meta.total ?? 0}
          pageFullySelected={pageFullySelected}
          allMatching={allMatching}
          isMoving={move.isPending}
          error={moveError}
          onSelectAllMatching={() => setAllMatching(true)}
          onClear={() => {
            setSelected(new Set());
            setAllMatching(false);
          }}
          onMove={runMove}
        />
      )}
      <AdminTable>
        <thead>
          <tr>
            {canWrite && (
              <Th>
                <input
                  type="checkbox"
                  aria-label="Selecionar os produtos desta página"
                  className="size-4 accent-geek-yellow"
                  checked={pageFullySelected}
                  onChange={togglePage}
                />
              </Th>
            )}
            <SortHeader
              label="Produto"
              field="name"
              sort={sort}
              onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
            />
            <Th>SKU</Th>
            <Th>Categoria</Th>
            <Th>Preço</Th>
            <Th>Estoque</Th>
            <Th>Situação</Th>
            <SortHeader
              label="Atualizado"
              field="updated_at"
              sort={sort}
              onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
            />
            <Th align="right">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={COLUMNS}>Carregando…</EmptyRow>}
          {rows.map((product) => (
            <tr
              key={product.product_id}
              className={`hover:bg-surface-secondary/50 ${selected.has(product.product_id) || allMatching ? 'bg-geek-yellow/10' : ''}`}
            >
              {canWrite && (
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${product.name}`}
                    className="size-4 accent-geek-yellow"
                    checked={allMatching || selected.has(product.product_id)}
                    onChange={() => toggleRow(product.product_id)}
                  />
                </Td>
              )}
              <Td className="min-w-[260px]">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/produtos/${product.product_id}/`}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Thumbnail src={product.thumbnail_url} />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/produtos/${product.product_id}/`}
                      className="line-clamp-2 font-extrabold hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span className="muted block text-xs">{product.brand ?? 'Sem marca'}</span>
                  </div>
                </div>
              </Td>
              <Td>
                <SkuCell product={product} />
              </Td>
              <Td>
                <CategoryCell label={labels.get(product.category_id)} />
              </Td>
              <Td>
                <PriceCell product={product} />
              </Td>
              <Td>
                <StockCell available={product.available} />
              </Td>
              <Td>
                <StatusCell product={product} />
              </Td>
              <Td className="muted text-xs whitespace-nowrap">
                {formatDateTime(product.updated_at)}
              </Td>
              <Td align="right">
                <Link
                  href={`/admin/produtos/${product.product_id}/`}
                  aria-label={`Editar ${product.name}`}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-ink"
                >
                  <Pencil size={16} />
                </Link>
              </Td>
            </tr>
          ))}
          {data && !data.data.length && (
            <EmptyRow colSpan={COLUMNS}>
              Nenhum produto encontrado.
              {hasFilters && (
                <button
                  type="button"
                  className="ml-2 font-extrabold text-foreground underline"
                  onClick={() =>
                    setParams({ q: null, category_id: null, status: null, issue: null })
                  }
                >
                  Limpar filtros
                </button>
              )}
            </EmptyRow>
          )}
        </tbody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
    </>
  );
}
