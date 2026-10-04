'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { getErrorMessage } from '../lib/errors';
import { formatBRL } from '../lib/money';
import { formatOrderDate, OrderStatusBadge } from '../order-view';
import { ProductImage } from '../product-image';
import { ordersQuery } from '../services/customer/queries';

export function AccountOrders() {
  const page = Math.max(1, Number(useSearchParams().get('page')) || 1);
  const { data, isPending, error } = useQuery(ordersQuery(page));

  if (isPending) return <p className="muted">Carregando seus pedidos…</p>;
  if (error)
    return (
      <p role="alert" className="error">
        {getErrorMessage(error)}
      </p>
    );
  if (data.data.length === 0) {
    return (
      <div className="surface p-[28px]">
        <h2 className="text-xl font-black">Você ainda não fez pedidos</h2>
        <p className="muted">Quando comprar com a sua conta, o pedido aparece aqui.</p>
        <Link className="action" href="/catalogo/">
          Explorar a coleção
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-black">Meus pedidos</h2>
      {data.data.map((order) => (
        <Link
          key={order.order_id}
          href={`/conta/pedidos/${order.number}/`}
          className="surface grid grid-cols-[64px_1fr_auto] items-center gap-4 p-4 hover:border-ink max-md:grid-cols-[54px_1fr]"
        >
          <span className="block h-[72px] w-[60px] overflow-hidden rounded-lg">
            <ProductImage src={order.first_item_image} alt="" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm">Pedido #{order.number}</strong>
            <span className="muted block truncate text-sm">
              {order.first_item_name}
              {order.item_count > 1 ? ` e mais ${order.item_count - 1}` : ''}
            </span>
            <small className="muted text-xs">{formatOrderDate(order.created_at)}</small>
          </span>
          <span className="grid justify-items-end gap-1.5 max-md:col-span-2 max-md:justify-items-start">
            <OrderStatusBadge status={order.display_status} />
            <strong>{formatBRL(order.total_cents)}</strong>
          </span>
        </Link>
      ))}
      {data.meta.total_pages > 1 && (
        <nav aria-label="Páginas" className="flex justify-between text-sm font-extrabold">
          {page > 1 ? (
            <Link href={`/conta/pedidos/?page=${page - 1}`}>← Mais novos</Link>
          ) : (
            <span />
          )}
          {page < data.meta.total_pages && (
            <Link href={`/conta/pedidos/?page=${page + 1}`}>Mais antigos →</Link>
          )}
        </nav>
      )}
    </div>
  );
}
