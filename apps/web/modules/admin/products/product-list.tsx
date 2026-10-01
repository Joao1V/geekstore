'use client';

import type { ProductListQuery } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { FieldSelect } from '@/components/ui';
import { CategoryAutocomplete } from '../categories/category-autocomplete';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { nextSort, useUrlState } from '../lib/use-url-state';
import { categoriesQueryOptions, productListQueryOptions } from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { SearchBox } from '../ui/search-box';
import { SortHeader } from '../ui/sort-header';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from './labels';

const ALL = 'all';
const PAGE_SIZE = 20;

type Filters = { status: string; category_id: string | null };

export function ProductList() {
  const canWrite = useCan('catalog:write');
  const { searchParams, setParams, page } = useUrlState();
  const q = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? ALL;
  const categoryId = searchParams.get('category_id');
  const sort = searchParams.get('sort') ?? 'updated_at:desc';

  const { data: categories } = useQuery(categoriesQueryOptions());
  const { data, isPending, error } = useQuery(
    productListQueryOptions({
      page,
      page_size: PAGE_SIZE,
      sort,
      q: q || undefined,
      status: status === ALL ? undefined : (status as ProductListQuery['status']),
      category_id: categoryId ?? undefined,
    })
  );

  const { control } = useForm<Filters>({ values: { status, category_id: categoryId } });
  const categoryById = new Map((categories ?? []).map((c) => [c.category_id, c.name]));

  return (
    <>
      <PageHeader
        title="Produtos"
        actions={
          canWrite && (
            <Link href="/admin/produtos/novo/" className="action">
              <Plus size={17} /> Novo produto
            </Link>
          )
        }
      />
      <div className="mb-5 grid grid-cols-[2fr_1fr_1fr] items-start gap-4 max-md:grid-cols-1">
        <SearchBox
          label="Buscar por nome ou SKU"
          initialValue={q}
          onSearch={(value) => setParams({ q: value })}
        />
        <Controller
          control={control}
          name="status"
          render={({ field, fieldState }) => (
            <FieldSelect
              field={{
                ...field,
                onChange: (value) => setParams({ status: value === ALL ? null : String(value) }),
              }}
              fieldState={fieldState}
              label="Situação"
              required={false}
              options={[
                { value: ALL, label: 'Todas' },
                ...Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
          )}
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
      <AdminTable>
        <thead>
          <tr>
            <SortHeader
              label="Produto"
              field="name"
              sort={sort}
              onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
            />
            <Th>Categoria</Th>
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
          {isPending && <EmptyRow colSpan={5}>Carregando…</EmptyRow>}
          {data?.data.map((product) => (
            <tr key={product.product_id}>
              <Td>
                <Link
                  href={`/admin/produtos/${product.product_id}/`}
                  className="font-extrabold hover:underline"
                >
                  {product.name}
                </Link>
                <span className="muted block text-xs">{product.brand ?? 'Sem marca'}</span>
              </Td>
              <Td>{categoryById.get(product.category_id) ?? '—'}</Td>
              <Td>
                <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
                  {PRODUCT_STATUS_LABELS[product.status]}
                </Badge>
              </Td>
              <Td>{formatDateTime(product.updated_at)}</Td>
              <Td align="right">
                <Link
                  href={`/admin/produtos/${product.product_id}/`}
                  aria-label={`Editar ${product.name}`}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-border"
                >
                  <Pencil size={16} />
                </Link>
              </Td>
            </tr>
          ))}
          {data && !data.data.length && <EmptyRow colSpan={5}>Nenhum produto encontrado.</EmptyRow>}
        </tbody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
    </>
  );
}
