'use client';

import type { ReceiptSummary } from '@geekstore/shared';
import { formatBRL } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useUrlState } from '../lib/use-url-state';
import { useImportReceipt } from '../services/purchasing/mutations';
import { receiptListQueryOptions } from '../services/purchasing/queries';
import { Badge } from '../ui/badge';
import { type FilterChip, FilterChips } from '../ui/filter-chips';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { SearchBox } from '../ui/search-box';
import { AdminTable, EmptyRow, TBody, Td, THead, Th, Tr } from '../ui/table';
import { ReceiptStatusBadge } from './receipt-status';

const PAGE_SIZE = 20;
const COLUMNS = 6;
type StatusParam = NonNullable<ReceiptSummary['status']>;
const STATUSES: readonly StatusParam[] = ['draft', 'posted'];
const STATUS_CHIPS: FilterChip[] = [
  { id: 'all', label: 'Todas' },
  { id: 'draft', label: 'Rascunhos' },
  { id: 'posted', label: 'Lançadas' },
];

/** Notas de entrada: importa o XML da NF-e e lista os rascunhos e as notas já lançadas. */
export function ReceiptList() {
  const router = useRouter();
  const canWrite = useCan('stock:write');
  const { searchParams, setParams, page } = useUrlState();
  const q = searchParams.get('q') ?? '';
  const status = STATUSES.find((value) => value === searchParams.get('status'));
  const { data, isPending, error } = useQuery(
    receiptListQueryOptions({ q: q || undefined, status, page, page_size: PAGE_SIZE })
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const importReceipt = useImportReceipt();
  const [importError, setImportError] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    try {
      const receipt = await importReceipt.mutateAsync({ xml: await file.text() });
      router.push(`/admin/notas/${receipt.receipt_id}/`);
    } catch (err) {
      setImportError(getErrorMessage(err));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div>
      <PageHeader
        title="Notas de entrada"
        crumbs={[{ label: 'Estoque' }, { label: 'Notas de entrada' }]}
        actions={
          canWrite && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="sr-only"
                aria-label="Arquivo XML da NF-e"
                onChange={(event) => onFile(event.target.files?.[0])}
              />
              <Action onPress={() => fileInput.current?.click()} disabled={importReceipt.isPending}>
                <FileUp size={17} />{' '}
                {importReceipt.isPending ? 'Lendo a nota…' : 'Importar NF-e (XML)'}
              </Action>
            </>
          )
        }
      />
      {importError && (
        <p className="error mb-4" role="alert">
          {importError}
        </p>
      )}
      <div className="mb-4">
        <SearchBox
          label="Buscar por número, fornecedor ou chave"
          initialValue={q}
          onSearch={(value) => setParams({ q: value || null, page: null })}
        />
      </div>
      <FilterChips
        label="Filtrar notas"
        chips={STATUS_CHIPS}
        active={status ?? 'all'}
        onSelect={(id) => setParams({ status: id === 'all' ? null : id, page: null })}
      />
      {error && (
        <p className="error mb-4" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable label="Notas de entrada">
        <THead>
          <Th isRowHeader>Nota</Th>
          <Th>Fornecedor</Th>
          <Th>Emissão</Th>
          <Th align="right">Itens</Th>
          <Th align="right">Total</Th>
          <Th>Situação</Th>
        </THead>
        <TBody>
          {isPending && <EmptyRow colSpan={COLUMNS}>Carregando…</EmptyRow>}
          {data?.data.map((receipt) => (
            <Tr key={receipt.receipt_id} className="hover:bg-surface-secondary/50">
              <Td>
                <Link
                  href={`/admin/notas/${receipt.receipt_id}/`}
                  className="font-extrabold underline-offset-4 hover:underline"
                >
                  {receipt.number ? `Nº ${receipt.number}` : 'Sem número'}
                  {receipt.series ? ` · série ${receipt.series}` : ''}
                </Link>
              </Td>
              <Td>{receipt.supplier?.name ?? '—'}</Td>
              <Td>{receipt.issued_at ? formatDateTime(receipt.issued_at) : '—'}</Td>
              <Td align="right">
                {receipt.item_count}
                {receipt.status === 'draft' && receipt.unmatched_count > 0 && (
                  <span className="ml-2">
                    <Badge tone="error">{receipt.unmatched_count} sem SKU</Badge>
                  </span>
                )}
              </Td>
              <Td align="right">{formatBRL(receipt.total_cents)}</Td>
              <Td>
                <ReceiptStatusBadge status={receipt.status} />
              </Td>
            </Tr>
          ))}
          {data && data.data.length === 0 && (
            <EmptyRow colSpan={COLUMNS}>
              Nenhuma nota ainda. Importe o XML de uma NF-e de compra para dar entrada no estoque.
            </EmptyRow>
          )}
        </TBody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: String(next) })} />
      )}
    </div>
  );
}
