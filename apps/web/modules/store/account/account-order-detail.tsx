'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { getErrorMessage } from '../lib/errors';
import { formatOrderDate, OrderStatusBadge, OrderView } from '../order-view';
import { orderQuery } from '../services/customer/queries';

export function AccountOrderDetail({ number }: { number: number }) {
  const { data: order, isPending, error } = useQuery(orderQuery(number));
  return (
    <div className="grid gap-5">
      <Link href="/conta/pedidos/" className="back-link">
        <ArrowLeft size={16} /> Meus pedidos
      </Link>
      {isPending && <p className="muted">Carregando…</p>}
      {error && (
        <p role="alert" className="error">
          {getErrorMessage(error)}
        </p>
      )}
      {order && (
        <>
          <div className="surface p-[22px]">
            <p className="eyebrow orange">Pedido #{order.number}</p>
            <p className="m-0 text-sm">
              Feito em {formatOrderDate(order.created_at)} ·{' '}
              <OrderStatusBadge status={order.display_status} />
            </p>
            {order.display_status === 'awaiting_payment' && (
              <p className="mt-3 mb-0 text-sm">
                Falta o pagamento.{' '}
                <Link className="orange font-extrabold" href={`/pedido/${order.order_id}/`}>
                  Ver como pagar
                </Link>
              </p>
            )}
          </div>
          <OrderView order={order} />
        </>
      )}
    </div>
  );
}
