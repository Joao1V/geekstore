'use client';

import { formatBRL, orderCancelBodySchema, orderShipBodySchema, toCents } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Ban, CheckCheck, PackageCheck, Truck, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Action, Dialog, FieldInput, FieldNumber } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import {
  useCancelOrder,
  useDeliverOrder,
  useRefundOrder,
  useShipOrder,
  useStartPicking,
} from '../services/orders/mutations';
import { orderDetailQueryOptions } from '../services/orders/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { AdminTable, TBody, Td, THead, Th, Tr } from '../ui/table';
import { OrderReturns } from './order-returns';
import { OrderStatusBadge } from './order-status';

type Dialogs = 'ship' | 'cancel' | 'refund' | null;
type RefundFormValues = { amount: number | null; reason: string };
const PAYMENT_STATE_LABELS = {
  pending: 'pendente',
  approved: 'aprovado',
  partially_refunded: 'parcialmente estornado',
  refunded: 'estornado',
} as const;
const REFUND_TONES = { pending: 'warning', succeeded: 'success', failed: 'error' } as const;
const REFUND_LABELS = {
  pending: 'Em processamento',
  succeeded: 'Concluído',
  failed: 'Falhou',
} as const;
const shipForm = orderShipBodySchema.pick({ carrier: true, tracking_code: true });
const ADDRESS_ORDER = [
  'street',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
  'zip',
] as const;

export function OrderDetail({ number }: { number: number }) {
  const canWrite = useCan('orders:write');
  const canRefund = useCan('orders:refund');
  const { data: order, isPending, error } = useQuery(orderDetailQueryOptions(number));
  const picking = useStartPicking(number);
  const ship = useShipOrder(number);
  const deliver = useDeliverOrder(number);
  const cancel = useCancelOrder(number);
  const refund = useRefundOrder(number);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [actionError, setActionError] = useState('');

  const shipForm_ = useForm<z.input<typeof shipForm>>({
    resolver: zodResolver(shipForm),
    defaultValues: { carrier: 'Correios', tracking_code: '' },
  });
  const cancelForm = useForm<z.input<typeof orderCancelBodySchema>>({
    resolver: zodResolver(orderCancelBodySchema),
    defaultValues: { reason: '' },
  });

  const refundForm = useForm<RefundFormValues>({ defaultValues: { amount: null, reason: '' } });

  if (isPending) return <p className="muted">Carregando…</p>;
  if (error || !order)
    return (
      <p className="error" role="alert">
        {getErrorMessage(error)}
      </p>
    );

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setActionError('');
    try {
      await action();
      after?.();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const open = order.status === 'open';
  const paid = order.payment_status !== 'pending';
  const canPick = canWrite && open && paid && order.fulfillment_status === 'not_picked';
  const canShip =
    canWrite && open && paid && ['not_picked', 'picking'].includes(order.fulfillment_status);
  const canDeliver =
    canWrite && ['shipped', 'partially_shipped'].includes(order.fulfillment_status);
  const canCancel =
    canWrite &&
    order.status !== 'cancelled' &&
    order.fulfillment_status !== 'delivered' &&
    !['shipped', 'partially_shipped'].includes(order.fulfillment_status);
  const address = order.shipping_address;
  // O que ainda dá para devolver: o que foi pago menos os estornos concluídos e em andamento.
  const refundable =
    (order.payment?.amount_cents ?? 0) -
    order.refunds
      .filter((item) => item.status !== 'failed')
      .reduce((sum, item) => sum + item.amount_cents, 0);
  const canRefundNow =
    canRefund &&
    ['approved', 'partially_refunded'].includes(order.payment_status) &&
    refundable > 0;
  const openRefund = () => {
    refundForm.reset({ amount: refundable / 100, reason: '' });
    setDialog('refund');
  };

  return (
    <div>
      <PageHeader
        title={`Pedido #${order.number}`}
        crumbs={[
          { label: 'Vendas' },
          { label: 'Pedidos', href: '/admin/pedidos/' },
          { label: `Pedido #${order.number}` },
        ]}
        eyebrow={formatDateTime(order.created_at)}
        actions={
          <>
            {canPick && (
              <Action
                className="action-outline"
                onPress={() => run(() => picking.mutateAsync(undefined))}
                disabled={picking.isPending}
              >
                <PackageCheck size={16} /> Iniciar separação
              </Action>
            )}
            {canShip && (
              <Action onPress={() => setDialog('ship')}>
                <Truck size={17} /> Enviar pedido
              </Action>
            )}
            {canDeliver && (
              <Action
                onPress={() => run(() => deliver.mutateAsync(undefined))}
                disabled={deliver.isPending}
              >
                <CheckCheck size={17} /> Marcar como entregue
              </Action>
            )}
            {canRefundNow && (
              <Action className="action-outline" onPress={openRefund}>
                <Undo2 size={16} /> Estornar
              </Action>
            )}
            {canCancel && (
              <Action className="action-outline" onPress={() => setDialog('cancel')}>
                <Ban size={16} /> Cancelar
              </Action>
            )}
          </>
        }
      />
      {actionError && (
        <p className="error mb-4" role="alert">
          {actionError}
        </p>
      )}
      {order.status === 'cancelled' && (
        <p className="notice mb-4">
          Cancelado{order.cancel_reason ? `: ${order.cancel_reason}` : ''}.{' '}
          {['approved', 'partially_refunded'].includes(order.payment_status) &&
            'O pagamento já tinha sido aprovado: faça o estorno do valor em "Estornar".'}
        </p>
      )}
      <dl className="surface mb-4 grid grid-cols-4 gap-4 p-4 text-sm max-md:grid-cols-2">
        <div>
          <dt className="muted text-xs">Situação</dt>
          <dd className="m-0 mt-1">
            <OrderStatusBadge status={order.display_status} />
          </dd>
        </div>
        <div>
          <dt className="muted text-xs">Pagamento</dt>
          <dd className="m-0 mt-1 font-extrabold">
            {order.payment
              ? `${order.payment.method === 'pix' ? 'Pix' : order.payment.method === 'card' ? 'Cartão' : 'Boleto'} · ${PAYMENT_STATE_LABELS[order.payment_status]}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="muted text-xs">Cliente</dt>
          <dd className="m-0 mt-1 font-extrabold">{order.contact.name}</dd>
          <dd className="muted m-0 text-xs">{order.contact.email}</dd>
        </div>
        <div>
          <dt className="muted text-xs">Total</dt>
          <dd className="m-0 mt-1 font-extrabold">{formatBRL(order.total_cents)}</dd>
        </div>
      </dl>
      <AdminTable label="Itens do pedido">
        <THead>
          <Th isRowHeader>Item</Th>
          <Th>SKU</Th>
          <Th align="right">Qtde</Th>
          <Th align="right">Unitário</Th>
          <Th align="right">Total</Th>
        </THead>
        <TBody>
          {order.items.map((item) => (
            <Tr key={item.sku_id}>
              <Td>
                <strong>{item.name}</strong>
                {item.variant && <small className="muted block text-xs">{item.variant}</small>}
              </Td>
              <Td>
                <code className="font-mono text-xs">{item.sku_code}</code>
              </Td>
              <Td align="right">{item.quantity}</Td>
              <Td align="right">{formatBRL(item.unit_price_cents)}</Td>
              <Td align="right">{formatBRL(item.total_cents)}</Td>
            </Tr>
          ))}
          <Tr>
            <Td colSpan={4} align="right">
              Frete ({order.shipping_service})
            </Td>
            <Td align="right">
              {order.shipping_cents ? formatBRL(order.shipping_cents) : 'Grátis'}
            </Td>
          </Tr>
          {order.discount_cents > 0 && (
            <Tr>
              <Td colSpan={4} align="right">
                Descontos{order.coupon_code ? ` (${order.coupon_code})` : ''}
              </Td>
              <Td align="right">−{formatBRL(order.discount_cents)}</Td>
            </Tr>
          )}
        </TBody>
      </AdminTable>
      {order.refunds.length > 0 && (
        <div className="surface mt-4 p-4 text-sm">
          <h2 className="mb-2 text-base font-extrabold">Estornos</h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {order.refunds.map((item) => (
              <li key={item.refund_id} className="flex flex-wrap items-center gap-3">
                <strong>{formatBRL(item.amount_cents)}</strong>
                <Badge tone={REFUND_TONES[item.status]}>{REFUND_LABELS[item.status]}</Badge>
                <span className="muted">
                  {formatDateTime(item.created_at)} · {item.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <OrderReturns order={order} canWrite={canWrite} />
      <div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <div className="surface p-4 text-sm">
          <h2 className="mb-2 text-base font-extrabold">Entrega</h2>
          <p className="m-0">{String(address.recipient ?? order.contact.name)}</p>
          <p className="m-0">
            {ADDRESS_ORDER.map((key) => String(address[key] ?? ''))
              .filter(Boolean)
              .join(' · ')}
          </p>
          {order.shipments.map((shipment) => (
            <p key={shipment.tracking_code ?? shipment.carrier} className="mt-2 mb-0">
              <strong>{shipment.carrier}</strong>
              {shipment.tracking_code && (
                <>
                  {' '}
                  · <code className="font-mono">{shipment.tracking_code}</code>
                </>
              )}
              {shipment.shipped_at && (
                <span className="muted"> · enviado em {formatDateTime(shipment.shipped_at)}</span>
              )}
            </p>
          ))}
        </div>
        <div className="surface p-4 text-sm">
          <h2 className="mb-2 text-base font-extrabold">Contato</h2>
          <p className="m-0">{order.contact.email}</p>
          {order.contact.phone && <p className="m-0">{order.contact.phone}</p>}
          {order.contact.document && <p className="m-0">Documento: {order.contact.document}</p>}
        </div>
      </div>

      <Dialog
        open={dialog === 'ship'}
        onChange={(next) => !next && setDialog(null)}
        title="Enviar pedido"
      >
        <form
          className="grid gap-4"
          noValidate
          onSubmit={shipForm_.handleSubmit((values) =>
            run(
              () =>
                ship.mutateAsync({
                  carrier: values.carrier,
                  tracking_code: values.tracking_code || undefined,
                }),
              () => setDialog(null)
            )
          )}
        >
          <p className="m-0 text-sm">
            O estoque dos itens sai agora e o cliente passa a ver o rastreio.
          </p>
          <Controller
            control={shipForm_.control}
            name="carrier"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Transportadora" />
            )}
          />
          <Controller
            control={shipForm_.control}
            name="tracking_code"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Código de rastreio (opcional)"
                required={false}
              />
            )}
          />
          <div className="flex justify-end gap-3">
            <Action type="button" className="action-outline" onPress={() => setDialog(null)}>
              Voltar
            </Action>
            <Action type="submit" disabled={ship.isPending}>
              {ship.isPending ? 'Enviando…' : 'Confirmar envio'}
            </Action>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'refund'}
        onChange={(next) => !next && setDialog(null)}
        title="Estornar pagamento"
      >
        <form
          className="grid gap-4"
          noValidate
          onSubmit={refundForm.handleSubmit((values) => {
            const cents = values.amount === null ? refundable : toCents(values.amount);
            if (cents <= 0 || cents > refundable) {
              refundForm.setError('amount', {
                message: `Informe um valor entre R$ 0,01 e ${formatBRL(refundable)}`,
              });
              return;
            }
            if (values.reason.trim().length < 3) {
              refundForm.setError('reason', { message: 'Diga o motivo do estorno' });
              return;
            }
            return run(
              () => refund.mutateAsync({ amount_cents: cents, reason: values.reason.trim() }),
              () => setDialog(null)
            );
          })}
        >
          <p className="m-0 text-sm">
            Devolve o dinheiro ao cliente pelo mesmo meio de pagamento. Pode estornar só uma parte.
            O pedido e o estoque não mudam: para isso, use Cancelar. Ainda dá para estornar{' '}
            <strong>{formatBRL(refundable)}</strong>.
          </p>
          <Controller
            control={refundForm.control}
            name="amount"
            render={({ field, fieldState }) => (
              <FieldNumber
                field={field}
                fieldState={fieldState}
                label="Valor a estornar"
                minValue={0.01}
                step={0.01}
                formatOptions={{ style: 'currency', currency: 'BRL' }}
              />
            )}
          />
          <Controller
            control={refundForm.control}
            name="reason"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Motivo do estorno" />
            )}
          />
          <div className="flex justify-end gap-3">
            <Action type="button" className="action-outline" onPress={() => setDialog(null)}>
              Voltar
            </Action>
            <Action type="submit" disabled={refund.isPending}>
              {refund.isPending ? 'Estornando…' : 'Confirmar estorno'}
            </Action>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'cancel'}
        onChange={(next) => !next && setDialog(null)}
        title="Cancelar pedido"
      >
        <form
          className="grid gap-4"
          noValidate
          onSubmit={cancelForm.handleSubmit((values) =>
            run(
              () => cancel.mutateAsync(values),
              () => setDialog(null)
            )
          )}
        >
          <p className="m-0 text-sm">
            Os itens reservados voltam para o estoque. O estorno do dinheiro, se houver, é feito à
            parte.
          </p>
          <Controller
            control={cancelForm.control}
            name="reason"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Motivo do cancelamento" />
            )}
          />
          <div className="flex justify-end gap-3">
            <Action type="button" className="action-outline" onPress={() => setDialog(null)}>
              Voltar
            </Action>
            <Action type="submit" disabled={cancel.isPending}>
              {cancel.isPending ? 'Cancelando…' : 'Cancelar pedido'}
            </Action>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
