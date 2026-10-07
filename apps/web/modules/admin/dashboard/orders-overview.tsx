'use client';

import { formatBRL } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, PackageOpen, ShoppingBag, Truck } from 'lucide-react';
import Link from 'next/link';

import { formatBRLCompact, formatInteger } from '../lib/format';
import { orderDashboardQueryOptions } from '../services/orders/queries';
import { KpiCard } from './kpi-card';

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const MIN_BAR_PERCENT = 3;

/** Vendas e fila de trabalho: o que entrou hoje, o que espera separação/envio e o gráfico da semana. */
export function OrdersOverview() {
  const { data } = useQuery(orderDashboardQueryOptions());
  if (!data) return null;

  const toShip = data.by_status.paid + data.by_status.picking;
  const peak = Math.max(1, ...data.last_7_days.map((day) => day.revenue_cents));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-4 gap-4 max-tablet:grid-cols-2 max-md:grid-cols-1">
        <KpiCard
          icon={ShoppingBag}
          label="Vendas hoje"
          value={formatBRLCompact(data.today.revenue_cents)}
          hint={`${formatInteger(data.today.orders)} ${data.today.orders === 1 ? 'pedido pago' : 'pedidos pagos'}`}
        />
        <Link href="/admin/pedidos/?status=paid" className="contents">
          <KpiCard
            icon={PackageOpen}
            label="Para separar e enviar"
            value={formatInteger(toShip)}
            hint={`${formatInteger(data.by_status.paid)} pagos · ${formatInteger(data.by_status.picking)} em separação`}
          />
        </Link>
        <Link href="/admin/pedidos/?status=awaiting_payment" className="contents">
          <KpiCard
            icon={CreditCard}
            label="Aguardando pagamento"
            value={formatInteger(data.by_status.awaiting_payment)}
            hint="expiram sozinhos se não forem pagos"
          />
        </Link>
        <Link href="/admin/pedidos/?status=shipped" className="contents">
          <KpiCard
            icon={Truck}
            label="A caminho do cliente"
            value={formatInteger(data.by_status.shipped)}
            hint={`${formatInteger(data.by_status.delivered)} já entregues`}
          />
        </Link>
      </div>
      <section className="surface p-5" aria-label="Vendas dos últimos 7 dias">
        <h2 className="mb-4 text-base font-extrabold">Vendas dos últimos 7 dias</h2>
        <ul className="m-0 grid h-40 list-none grid-cols-7 items-end gap-3 p-0">
          {data.last_7_days.map((day) => (
            <li
              key={day.date}
              className="flex h-full flex-col items-center justify-end gap-1"
              title={`${formatBRL(day.revenue_cents)} em ${day.orders} ${day.orders === 1 ? 'pedido' : 'pedidos'}`}
            >
              <span className="muted text-2xs tabular-nums">
                {day.revenue_cents > 0 ? formatBRLCompact(day.revenue_cents) : ''}
              </span>
              <span
                className="w-full max-w-12 rounded-t-md bg-geek-yellow"
                style={{
                  height: `${Math.max(MIN_BAR_PERCENT, (day.revenue_cents / peak) * 100)}%`,
                }}
              />
              <span className="muted text-xs capitalize">
                {WEEKDAY.format(new Date(`${day.date}T00:00:00Z`)).replace('.', '')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
