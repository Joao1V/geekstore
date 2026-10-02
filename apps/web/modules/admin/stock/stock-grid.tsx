'use client';

import type { Location, SkuGridRow } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowLeftRight, History, RotateCcw, Save } from 'lucide-react';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Action, FieldInput } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCan } from '../lib/use-can';
import { nextSort, useUrlState } from '../lib/use-url-state';
import { skuGridQueryOptions } from '../services/catalog/queries';
import { useBulkPriceUpdate } from '../services/pricing/mutations';
import { useBulkStockUpdate } from '../services/stock/mutations';
import { locationsQueryOptions } from '../services/stock/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { SearchBox } from '../ui/search-box';
import { SortHeader } from '../ui/sort-header';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { Thumbnail } from '../ui/thumbnail';
import { type EditMap, formatPriceInput, type RowEdit, rowState } from './grid-edits';
import { MovementDialog } from './movement-dialog';
import { MovementHistoryDialog } from './movement-history';

const PAGE_SIZE = 50;
const MAX_BATCH = 500;
const DEFAULT_REASON = 'Ajuste pela grade';
const CELL_INPUT =
  'w-28 rounded-lg border bg-surface-secondary px-2.5 py-1.5 text-right text-sm text-foreground';
const ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-lg border border-border bg-surface disabled:opacity-40';

type ColumnKey = 'price' | 'on_hand';
type SaveStatus = { tone: 'success' | 'error' | 'partial'; text: string } | null;

function GridInput({
  row,
  rowIndex,
  column,
  value,
  isDirty,
  isInvalid,
  disabled,
  label,
  onChange,
  onUndo,
  registerInput,
  focusCell,
}: {
  row: SkuGridRow;
  rowIndex: number;
  column: ColumnKey;
  value: string;
  isDirty: boolean;
  isInvalid: boolean;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  onUndo: () => void;
  registerInput: (key: string, element: HTMLInputElement | null) => void;
  focusCell: (rowIndex: number, column: ColumnKey) => void;
}) {
  const tone = isInvalid
    ? 'border-status-error'
    : isDirty
      ? 'border-geek-yellow bg-geek-yellow/15'
      : 'border-border';
  return (
    <input
      ref={(element) => registerInput(`${rowIndex}:${column}`, element)}
      aria-label={`${label} de ${row.code}`}
      aria-invalid={isInvalid}
      inputMode={column === 'price' ? 'decimal' : 'numeric'}
      disabled={disabled}
      value={value}
      className={`${CELL_INPUT} ${tone} disabled:opacity-60`}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          focusCell(rowIndex + (event.shiftKey ? -1 : 1), column);
        } else if (event.key === 'Escape') {
          onUndo();
        }
      }}
    />
  );
}

export function StockGrid() {
  const canStockWrite = useCan('stock:write');
  const canPriceWrite = useCan('pricing:write');
  const { searchParams, setParams, page } = useUrlState();
  const q = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') ?? 'code:asc';

  const { data, isPending, error } = useQuery(
    skuGridQueryOptions({ page, page_size: PAGE_SIZE, sort, q: q || undefined })
  );
  const { data: locations = [] } = useQuery(locationsQueryOptions());
  const bulkPrice = useBulkPriceUpdate();
  const bulkStock = useBulkStockUpdate();

  const [edits, setEdits] = useState<EditMap>({});
  const [status, setStatus] = useState<SaveStatus>(null);
  const [moving, setMoving] = useState<SkuGridRow | null>(null);
  const [history, setHistory] = useState<SkuGridRow | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  // O `on_hand` da grade é o saldo agregado; só dá para editá-lo direto com um único local.
  const canEditOnHand = canStockWrite && locations.length === 1;
  const targetLocation: Location | undefined = locations.length === 1 ? locations[0] : undefined;

  const { control, handleSubmit } = useForm<{ reason: string }>({
    defaultValues: { reason: DEFAULT_REASON },
  });

  const registerInput = useCallback((key: string, element: HTMLInputElement | null) => {
    if (element) inputs.current.set(key, element);
    else inputs.current.delete(key);
  }, []);
  const focusCell = useCallback((rowIndex: number, column: ColumnKey) => {
    inputs.current.get(`${rowIndex}:${column}`)?.focus();
  }, []);

  const setCell = useCallback((row: SkuGridRow, column: ColumnKey, value: string) => {
    setStatus(null);
    setEdits((current) => ({
      ...current,
      [row.sku_id]: { ...(current[row.sku_id] ?? { base: row }), [column]: value },
    }));
  }, []);
  const undoRow = useCallback((skuId: string) => {
    setStatus(null);
    setEdits((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => id !== skuId))
    );
  }, []);

  const summary = useMemo(() => {
    const entries = Object.values(edits).map((edit) => ({ edit, state: rowState(edit) }));
    return {
      entries,
      dirtyRows: entries.filter(({ state }) => state.priceDirty || state.stockDirty).length,
      invalidCount: entries.filter(({ state }) => state.priceInvalid || state.stockInvalid).length,
    };
  }, [edits]);

  const columns = useMemo<ColumnDef<SkuGridRow>[]>(
    () => [
      {
        id: 'code',
        header: () => (
          <SortHeader
            label="SKU"
            field="code"
            sort={sort}
            onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
          />
        ),
        cell: ({ row }) => (
          <Td>
            <strong>{row.original.code}</strong>
            {row.original.status === 'inactive' && (
              <span className="ml-2">
                <Badge>Inativo</Badge>
              </span>
            )}
          </Td>
        ),
      },
      {
        id: 'product_name',
        header: () => (
          <SortHeader
            label="Produto"
            field="product_name"
            sort={sort}
            onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
          />
        ),
        cell: ({ row }) => {
          const attributes = Object.entries(row.original.attributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' · ');
          return (
            <Td className="min-w-[200px]">
              <div className="flex items-center gap-3">
                <Thumbnail src={row.original.thumbnail_url} />
                <div className="min-w-0">
                  {row.original.product_name}
                  {attributes && <span className="muted block text-xs">{attributes}</span>}
                </div>
              </div>
            </Td>
          );
        },
      },
      {
        id: 'price_cents',
        header: () => (
          <SortHeader
            label="Preço (R$)"
            field="price_cents"
            sort={sort}
            align="right"
            onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
          />
        ),
        cell: ({ row }) => {
          const edit = edits[row.original.sku_id];
          const state = edit ? rowState(edit) : null;
          return (
            <Td align="right">
              <GridInput
                row={row.original}
                rowIndex={row.index}
                column="price"
                label="Preço"
                value={edit?.price ?? formatPriceInput(row.original.price_cents)}
                isDirty={state?.priceDirty ?? false}
                isInvalid={state?.priceInvalid ?? false}
                disabled={!canPriceWrite}
                onChange={(value) => setCell(row.original, 'price', value)}
                onUndo={() => undoRow(row.original.sku_id)}
                registerInput={registerInput}
                focusCell={focusCell}
              />
            </Td>
          );
        },
      },
      {
        id: 'on_hand',
        header: () => <Th align="right">Físico</Th>,
        cell: ({ row }) => {
          const edit = edits[row.original.sku_id];
          const state = edit ? rowState(edit) : null;
          return (
            <Td align="right">
              <GridInput
                row={row.original}
                rowIndex={row.index}
                column="on_hand"
                label="Estoque físico"
                value={edit?.on_hand ?? String(row.original.on_hand)}
                isDirty={state?.stockDirty ?? false}
                isInvalid={state?.stockInvalid ?? false}
                disabled={!canEditOnHand}
                onChange={(value) => setCell(row.original, 'on_hand', value)}
                onUndo={() => undoRow(row.original.sku_id)}
                registerInput={registerInput}
                focusCell={focusCell}
              />
            </Td>
          );
        },
      },
      {
        id: 'reserved',
        header: () => <Th align="right">Reservado</Th>,
        cell: ({ row }) => <Td align="right">{row.original.reserved}</Td>,
      },
      {
        id: 'available',
        header: () => (
          <SortHeader
            label="Disponível"
            field="available"
            sort={sort}
            align="right"
            onSort={(field) => setParams({ sort: nextSort(sort, field) }, false)}
          />
        ),
        cell: ({ row }) => (
          <Td align="right" className="font-extrabold">
            {row.original.available}
          </Td>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <Th align="right">
            <span className="sr-only">Ações</span>
          </Th>
        ),
        cell: ({ row }) => {
          const isEdited = Boolean(edits[row.original.sku_id]);
          return (
            <Td align="right">
              <span className="inline-flex gap-1.5">
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Desfazer alterações de ${row.original.code}`}
                  title="Desfazer (Esc)"
                  disabled={!isEdited}
                  onClick={() => undoRow(row.original.sku_id)}
                >
                  <RotateCcw size={14} />
                </button>
                {canStockWrite && (
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    aria-label={`Movimentar ${row.original.code}`}
                    title="Entrada, saída ou ajuste"
                    onClick={() => setMoving(row.original)}
                  >
                    <ArrowLeftRight size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Histórico de ${row.original.code}`}
                  title="Histórico de movimentações"
                  onClick={() => setHistory(row.original)}
                >
                  <History size={14} />
                </button>
              </span>
            </Td>
          );
        },
      },
    ],
    [
      edits,
      sort,
      setParams,
      canPriceWrite,
      canEditOnHand,
      canStockWrite,
      setCell,
      undoRow,
      registerInput,
      focusCell,
    ]
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.sku_id,
    manualSorting: true,
    manualPagination: true,
  });

  const save = async ({ reason }: { reason: string }) => {
    setStatus(null);
    if (summary.invalidCount > 0) {
      setStatus({ tone: 'error', text: 'Corrija os campos em vermelho antes de salvar.' });
      return;
    }
    const priceItems = summary.entries
      .filter(({ state }) => state.priceDirty && state.priceCents !== null)
      .map(({ edit, state }) => ({
        sku_id: edit.base.sku_id,
        price_cents: state.priceCents as number,
      }));
    const stockItems = summary.entries
      .filter(({ state }) => state.stockDirty && state.onHand !== null)
      .map(({ edit, state }) => ({
        sku_id: edit.base.sku_id,
        location_id: targetLocation?.location_id ?? '',
        on_hand: state.onHand as number,
      }));
    if (priceItems.length > MAX_BATCH || stockItems.length > MAX_BATCH) {
      setStatus({ tone: 'error', text: `Salve em lotes de até ${MAX_BATCH} linhas.` });
      return;
    }
    if (stockItems.length > 0 && !targetLocation) {
      setStatus({ tone: 'error', text: 'Não há um único local de estoque para gravar o saldo.' });
      return;
    }

    // UMA chamada de preço e UMA de estoque, nunca uma por linha.
    const [priceResult, stockResult] = await Promise.allSettled([
      priceItems.length ? bulkPrice.mutateAsync({ items: priceItems }) : Promise.resolve(null),
      stockItems.length
        ? bulkStock.mutateAsync({ reason: reason.trim() || DEFAULT_REASON, items: stockItems })
        : Promise.resolve(null),
    ]);

    const priceOk = priceResult.status === 'fulfilled';
    const stockOk = stockResult.status === 'fulfilled';
    const savedPrices = new Set(priceOk ? priceItems.map((item) => item.sku_id) : []);
    const savedStock = new Set(stockOk ? stockItems.map((item) => item.sku_id) : []);

    setEdits((current) => {
      const next: EditMap = {};
      for (const [skuId, edit] of Object.entries(current)) {
        const kept: RowEdit = { base: edit.base };
        if (edit.price !== undefined && !savedPrices.has(skuId)) kept.price = edit.price;
        if (edit.on_hand !== undefined && !savedStock.has(skuId)) kept.on_hand = edit.on_hand;
        if (kept.price !== undefined || kept.on_hand !== undefined) next[skuId] = kept;
      }
      return next;
    });

    const failures = [priceResult, stockResult]
      .map((result, index) =>
        result.status === 'rejected'
          ? `${index === 0 ? 'Preços' : 'Estoque'}: ${getErrorMessage(result.reason)}`
          : null
      )
      .filter(Boolean);
    if (!failures.length) {
      setStatus({
        tone: 'success',
        text: `${priceItems.length} preço(s) e ${stockItems.length} saldo(s) salvos.`,
      });
    } else {
      setStatus({
        tone: priceOk || stockOk ? 'partial' : 'error',
        text: `${priceOk || stockOk ? 'Salvo parcialmente. ' : 'Nada foi salvo. '}${failures.join(' ')}`,
      });
    }
  };

  const isSaving = bulkPrice.isPending || bulkStock.isPending;

  return (
    <>
      <PageHeader title="Estoque e preços" />
      <div className="mb-4 grid grid-cols-[minmax(0,420px)_1fr] items-start gap-4 max-md:grid-cols-1">
        <SearchBox
          label="Buscar por SKU ou produto"
          initialValue={q}
          onSearch={(value) => setParams({ q: value })}
        />
      </div>
      {locations.length > 1 && (
        <p className="notice">
          Há mais de um local de estoque: o saldo físico da grade é a soma dos locais e não é
          editável aqui. Use o botão de movimentação de cada SKU (entrada, saída ou ajuste por
          local). O preço continua editável na grade.
        </p>
      )}
      <form
        onSubmit={handleSubmit(save)}
        className="surface mb-4 grid grid-cols-[1fr_auto] items-end gap-4 p-4 max-md:grid-cols-1"
        noValidate
      >
        <Controller
          control={control}
          name="reason"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Motivo do ajuste de estoque"
              description="Registrado em cada movimentação gerada pela grade."
              required={false}
            />
          )}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted" aria-live="polite">
            {summary.dirtyRows} linha(s) alterada(s)
            {summary.invalidCount > 0 && `, ${summary.invalidCount} com erro`}
          </span>
          <Action
            className="action-outline"
            disabled={!Object.keys(edits).length || isSaving}
            onPress={() => {
              setEdits({});
              setStatus(null);
            }}
          >
            Descartar tudo
          </Action>
          <Action type="submit" disabled={summary.dirtyRows === 0 || isSaving}>
            <Save size={17} /> {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </Action>
        </div>
      </form>
      {status && (
        <p
          role={status.tone === 'success' ? 'status' : 'alert'}
          className={status.tone === 'success' ? 'notice mt-0' : 'error mt-0'}
        >
          {status.text}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <Fragment key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Fragment>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={columns.length}>Carregando…</EmptyRow>}
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Fragment key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Fragment>
              ))}
            </tr>
          ))}
          {data && !data.data.length && (
            <EmptyRow colSpan={columns.length}>Nenhum SKU encontrado.</EmptyRow>
          )}
        </tbody>
      </AdminTable>
      <p className="demo-note">
        Enter desce para a linha de baixo (Shift+Enter sobe), Tab avança entre células e Esc desfaz
        a linha. Digite preços em reais, com vírgula ou ponto nos centavos (349,90).
      </p>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
      <MovementDialog row={moving} locations={locations} onClose={() => setMoving(null)} />
      <MovementHistoryDialog row={history} locations={locations} onClose={() => setHistory(null)} />
    </>
  );
}
