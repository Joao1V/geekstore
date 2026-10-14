'use client';

import type { Location, SkuGridRow } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Dialog } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { movementListQueryOptions } from '../services/stock/queries';
import { PaginationBar } from '../ui/pagination-bar';
import { AdminTable, EmptyRow, TBody, Td, THead, Th, Tr } from '../ui/table';
import { MOVEMENT_TYPE_LABELS } from './movement-labels';

const PAGE_SIZE = 10;

function History({ row, locations }: { row: SkuGridRow; locations: Location[] }) {
  const [page, setPage] = useState(1);
  const { data, isPending, error } = useQuery(
    movementListQueryOptions({
      sku_id: row.sku_id,
      page,
      page_size: PAGE_SIZE,
      sort: 'created_at:desc',
    })
  );
  const locationName = new Map(locations.map((l) => [l.location_id, l.name]));

  return (
    <div className="grid gap-2">
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable label="Movimentações">
        <THead>
          <Th isRowHeader>Data</Th>
          <Th>Tipo</Th>
          <Th align="right">Qtd.</Th>
          <Th>Local</Th>
          <Th>Motivo</Th>
        </THead>
        <TBody>
          {isPending && <EmptyRow colSpan={5}>Carregando…</EmptyRow>}
          {data?.data.map((movement) => (
            <Tr key={movement.stock_movement_id}>
              <Td>{formatDateTime(movement.created_at)}</Td>
              <Td>{MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}</Td>
              <Td align="right">{movement.quantity}</Td>
              <Td>{locationName.get(movement.location_id) ?? '—'}</Td>
              <Td>{movement.reason ?? '—'}</Td>
            </Tr>
          ))}
          {data && !data.data.length && <EmptyRow colSpan={5}>Sem movimentações.</EmptyRow>}
        </TBody>
      </AdminTable>
      {data && <PaginationBar meta={data.meta} onPage={setPage} />}
    </div>
  );
}

export function MovementHistoryDialog({
  row,
  locations,
  onClose,
}: {
  row: SkuGridRow | null;
  locations: Location[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={row !== null}
      onChange={(open) => !open && onClose()}
      title={row ? `Histórico de ${row.code}` : 'Histórico'}
      size="lg"
    >
      {row && <History row={row} locations={locations} />}
    </Dialog>
  );
}
