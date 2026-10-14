'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Hourglass, XCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getMascot } from '@/lib/mascot';
import { PAYMENTS_ARE_REAL } from '@/lib/mercado-pago';
import { getErrorMessage } from './lib/errors';
import { formatOrderDate, OrderStatusBadge, OrderView } from './order-view';
import { useSimulatePayment } from './services/checkout/mutations';
import { orderByIdQuery } from './services/checkout/queries';
import { useCustomerStore } from './state/customer-store';

const POLL_MS = 4_000;
// O botão de "pagar" do teste só existe fora de produção (a API também recusa em produção).
const CAN_SIMULATE = process.env.NODE_ENV !== 'production' && !PAYMENTS_ARE_REAL;

/** Página do pedido logo depois da compra: instruções de pagamento e acompanhamento do status. */
export function OrderConfirmation({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const customer = useCustomerStore((state) => state.customer);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const simulate = useSimulatePayment();
  const { data: order, error: loadError } = useQuery({
    ...orderByIdQuery(orderId),
    // Enquanto espera o pagamento, confere sozinho de tempos em tempos.
    refetchInterval: (query) =>
      query.state.data?.display_status === 'awaiting_payment' ? POLL_MS : false,
  });

  if (loadError) {
    return (
      <section className="wrap section empty">
        <h1 className="section-title">Pedido não encontrado</h1>
        <p className="error">{getErrorMessage(loadError)}</p>
        <Link className="action" href="/catalogo/">
          Voltar à coleção
        </Link>
      </section>
    );
  }
  if (!order) return <p className="wrap section">Carregando seu pedido…</p>;

  const payment = order.payment;
  const waiting = order.display_status === 'awaiting_payment';
  const code = String(payment?.details?.pix_code ?? payment?.details?.barcode_line ?? '');

  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };
  const pay = async () => {
    setError('');
    try {
      const paid = await simulate.mutateAsync(order.order_id);
      queryClient.setQueryData(orderByIdQuery(orderId).queryKey, paid);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <section className="wrap section">
      <div className="mx-auto grid max-w-[880px] gap-6">
        <div className="surface grid grid-cols-[1fr_auto] items-center gap-5 p-[28px] max-md:grid-cols-1">
          <div>
            <p className="eyebrow orange">Pedido #{order.number}</p>
            <h1 className="section-title mb-2 flex items-center gap-3">
              {order.display_status === 'cancelled' ? (
                <XCircle className="text-status-error" size={34} />
              ) : waiting ? (
                <Hourglass className="text-status-warning" size={34} />
              ) : (
                <CheckCircle2 className="text-status-success" size={34} />
              )}
              {waiting
                ? 'Falta só o pagamento'
                : order.display_status === 'cancelled'
                  ? 'Pedido cancelado'
                  : 'Pedido confirmado!'}
            </h1>
            <p className="muted m-0 text-sm">
              Feito em {formatOrderDate(order.created_at)} ·{' '}
              <OrderStatusBadge status={order.display_status} />
            </p>
          </div>
          <Image
            {...getMascot('parcel')}
            width={120}
            height={140}
            alt=""
            className="max-md:hidden"
          />
        </div>

        {waiting && payment && (
          <div className="surface p-[28px]">
            <h2 className="mb-2 text-xl font-black">
              {payment.method === 'pix' ? 'Pague com Pix' : 'Pague o boleto'}
            </h2>
            <p className="muted text-sm">
              {payment.method === 'pix'
                ? 'Copie o código e pague no app do seu banco (Pix copia e cola).'
                : `Use a linha digitável. Vencimento: ${String(payment.details?.due_date ?? '')}.`}
              {payment.expires_at &&
                ` Reservamos seus itens até ${formatOrderDate(payment.expires_at)}.`}
            </p>
            {typeof payment.details?.pix_qr_base64 === 'string' && (
              // biome-ignore lint/performance/noImgElement: QR code em base64 (data URI), não há o que otimizar
              <img
                src={`data:image/png;base64,${payment.details.pix_qr_base64}`}
                alt="QR code do Pix"
                width={200}
                height={200}
                className="mb-4 rounded-lg border border-border bg-white p-2"
              />
            )}
            <code className="mb-4 block break-all rounded-lg bg-surface-secondary p-3.5 font-mono text-xs">
              {code}
            </code>
            <div className="flex flex-wrap gap-3">
              <Action onPress={copy}>
                <Copy size={17} /> {copied ? 'Copiado!' : 'Copiar código'}
              </Action>
              {typeof payment.details?.boleto_url === 'string' && (
                <a
                  className="action action-outline"
                  href={payment.details.boleto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir o boleto
                </a>
              )}
              {CAN_SIMULATE && (
                <Action className="action-outline" onPress={pay} disabled={simulate.isPending}>
                  {simulate.isPending ? 'Pagando…' : 'Simular pagamento (teste)'}
                </Action>
              )}
            </div>
            {error && (
              <p role="alert" className="error mt-3">
                {error}
              </p>
            )}
            <p className="muted mt-4 mb-0 text-xs">
              Esta página confere o pagamento sozinha a cada poucos segundos.
            </p>
          </div>
        )}

        <OrderView order={order} />

        <div className="flex flex-wrap gap-3">
          {customer ? (
            <Link className="action" href={`/conta/pedidos/${order.number}/`}>
              Ver nos meus pedidos
            </Link>
          ) : (
            <p className="notice m-0 flex-1">
              Guarde o endereço desta página para acompanhar o pedido. Com uma conta, ele fica no
              seu histórico:{' '}
              <Link className="orange font-extrabold" href="/cadastro/">
                criar conta
              </Link>
              .
            </p>
          )}
          <Link className="action action-outline" href="/catalogo/">
            Continuar comprando
          </Link>
        </div>
      </div>
    </section>
  );
}
