'use client';

import type { OutboxStatus } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { useState } from 'react';

import { IconAction } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useUrlState } from '../lib/use-url-state';
import { useRetryOutboxEvent } from '../services/outbox/mutations';
import { outboxQueryOptions, outboxSummaryQueryOptions } from '../services/outbox/queries';
import { Badge } from '../ui/badge';
import { type FilterChip, FilterChips } from '../ui/filter-chips';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { AdminTable, EmptyRow, TBody, Td, THead, Th, Tr } from '../ui/table';

const PAGE_SIZE = 20;
const COLUMNS = 6;
const STATUS_LABELS: Record<OutboxStatus, string> = {
  pending: 'Pendente',
  published: 'Publicado',
  failed: 'Falhou',
};
const STATUS_TONES = { pending: 'warning', published: 'success', failed: 'error' } as const;
const TYPE_LABELS: Record<string, string> = {
  'order.created': 'Pedido criado',
  'order.paid': 'Pedido pago',
  'order.shipped': 'Pedido enviado',
  'order.delivered': 'Pedido entregue',
  'order.cancelled': 'Pedido cancelado',
  'stock.divergence_found': 'Estoque divergente',
};

const isStatus = (value: string | null): value is OutboxStatus =>
  value === 'pending' || value === 'published' || value === 'failed';

/** Eventos de negócio do outbox (RF-PLA-07): esperando, publicados e com falha, com reprocesso. */
export function OutboxList() {
  const canWrite = useCan('queues:write');
  const { searchParams, setParams, page } = useUrlState();
  const rawStatus = searchParams.get('status');
  const status = isStatus(rawStatus) ? rawStatus : undefined;
  const { data, isPending, error } = useQuery(
    outboxQueryOptions({ page, page_size: PAGE_SIZE, status })
  );
  const { data: summary } = useQuery(outboxSummaryQueryOptions());
  const retry = useRetryOutboxEvent();
  const [actionError, setActionError] = useState('');

  const chips: FilterChip[] = [
    { id: 'all', label: 'Todos' },
    { id: 'failed', label: 'Com falha', count: summary?.failed, attention: 'error' },
    { id: 'pending', label: 'Pendentes', count: summary?.pending, attention: 'warning' },
    { id: 'published', label: 'Publicados' },
  ];

  const reprocess = async (eventId: string) => {
    setActionError('');
    try {
      await retry.mutateAsync(eventId);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Eventos" crumbs={[{ label: 'Sistema' }, { label: 'Eventos' }]} />
      <p className="muted mb-4 max-w-3xl text-sm">
        Cada mudança importante (pedido criado, pago, enviado...) vira um evento gravado junto da
        mudança e entregue à fila, que dispara e-mails e avisos. Se um evento falhar, ele aparece
        aqui e pode ser reprocessado.
      </p>
      <FilterChips
        label="Filtrar eventos"
        chips={chips}
        active={status ?? 'all'}
        onSelect={(id) => setParams({ status: id === 'all' ? null : id })}
      />
      {(error || actionError) && (
        <p className="error mb-4" role="alert">
          {actionError || getErrorMessage(error)}
        </p>
      )}
      <AdminTable label="Eventos">
        <THead>
          <Th isRowHeader>Quando</Th>
          <Th>Evento</Th>
          <Th>Situação</Th>
          <Th align="right">Tentativas</Th>
          <Th>Último erro</Th>
          <Th align="right">
            <span className="sr-only">Ações</span>
          </Th>
        </THead>
        <TBody>
          {isPending && <EmptyRow colSpan={COLUMNS}>Carregando…</EmptyRow>}
          {data?.data.map((event) => (
            <Tr key={event.outbox_event_id}>
              <Td className="whitespace-nowrap">{formatDateTime(event.created_at)}</Td>
              <Td>
                <strong>{TYPE_LABELS[event.type] ?? event.type}</strong>
                <span className="muted block font-mono text-2xs break-all">{event.entity_id}</span>
              </Td>
              <Td>
                <Badge tone={STATUS_TONES[event.status]}>{STATUS_LABELS[event.status]}</Badge>
              </Td>
              <Td align="right" className="tabular-nums">
                {event.attempts}
              </Td>
              <Td className="max-w-[320px] text-xs break-words">{event.last_error ?? '—'}</Td>
              <Td align="right">
                {canWrite && event.status !== 'pending' && (
                  <IconAction
                    label="Reprocessar evento"
                    disabled={retry.isPending}
                    onPress={() => reprocess(event.outbox_event_id)}
                  >
                    <RotateCw size={16} />
                  </IconAction>
                )}
              </Td>
            </Tr>
          ))}
          {data && !data.data.length && <EmptyRow colSpan={COLUMNS}>Nenhum evento.</EmptyRow>}
        </TBody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
    </>
  );
}
