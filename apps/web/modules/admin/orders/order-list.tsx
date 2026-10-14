'use client';

import { formatBRL } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useUrlState } from '../lib/use-url-state';
import { orderListQueryOptions } from '../services/orders/queries';
import { FilterChips } from '../ui/filter-chips';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { SearchBox } from '../ui/search-box';
import { AdminTable, EmptyRow, TBody, Td, THead, Th, Tr } from '../ui/table';
import { ORDER_STATUS_CHIPS, OrderStatusBadge } from './order-status';

const PAGE_SIZE = 20;
const COLUMNS = 6;
const PAYMENT_LABEL = { pix: 'Pix', card: 'Cartão', boleto: 'Boleto' } as const;

export function OrderList() {
  const { searchParams, setParams, page } = useUrlState();
  const q = searchParams.get('q') ?? '';
  const status =
    ORDER_STATUS_CHIPS.find((chip) => chip.id === searchParams.get('status'))?.id ?? 'all';
  const { data, isPending, error } = useQuery(
    orderListQueryOptions({
      q: q || undefined,
      status: status === 'all' ? undefined : (status as never),
      page,
      page_size: PAGE_SIZE,
    })
  );

  return (
    <div>
      <PageHeader title="Pedidos" crumbs={[{ label: 'Vendas' }, { label: 'Pedidos' }]} />
      <div className="mb-4">
        <SearchBox
          label="Buscar por número, cliente, e-mail ou SKU"
          initialValue={q}
          onSearch={(value) => setParams({ q: value || null, page: null })}
        />
      </div>
      <FilterChips
        label="Filtrar pedidos"
        chips={ORDER_STATUS_CHIPS}
        active={status}
        onSelect={(id) => setParams({ status: id === 'all' ? null : id, page: null })}
      />
      {error && (
        <p className="error mb-4" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable label="Pedidos">
        <THead>
          <Th isRowHeader>Pedido</Th>
          <Th>Cliente</Th>
          <Th>Pagamento</Th>
          <Th align="right">Itens</Th>
          <Th align="right">Total</Th>
          <Th>Situação</Th>
        </THead>
        <TBody>
          {isPending && <EmptyRow colSpan={COLUMNS}>Carregando…</EmptyRow>}
          {data?.data.map((order) => (
            <Tr key={order.order_id} className="hover:bg-surface-secondary/50">
              <Td>
                <Link
                  href={`/admin/pedidos/${order.number}/`}
                  className="font-extrabold underline-offset-4 hover:underline"
                >
                  #{order.number}
                </Link>
                <small className="muted block text-xs">{formatDateTime(order.created_at)}</small>
              </Td>
              <Td>
                {order.contact_name}
                <small className="muted block text-xs">{order.contact_email}</small>
              </Td>
              <Td>{order.payment_method ? PAYMENT_LABEL[order.payment_method] : '—'}</Td>
              <Td align="right">{order.item_count}</Td>
              <Td align="right">{formatBRL(order.total_cents)}</Td>
              <Td>
                <OrderStatusBadge status={order.display_status} />
              </Td>
            </Tr>
          ))}
          {data && data.data.length === 0 && (
            <EmptyRow colSpan={COLUMNS}>Nenhum pedido encontrado.</EmptyRow>
          )}
        </TBody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: String(next) })} />
      )}
    </div>
  );
}
