'use client';

import { formatBRL, orderCancelBodySchema, orderShipBodySchema } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Ban, CheckCheck, PackageCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Action, Dialog, FieldInput } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import {
  useCancelOrder,
  useDeliverOrder,
  useShipOrder,
  useStartPicking,
} from '../services/orders/mutations';
import { orderDetailQueryOptions } from '../services/orders/queries';
import { PageHeader } from '../ui/page-header';
import { AdminTable, TBody, Td, THead, Th, Tr } from '../ui/table';
import { OrderStatusBadge } from './order-status';

type Dialogs = 'ship' | 'cancel' | null;
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
  const { data: order, isPending, error } = useQuery(orderDetailQueryOptions(number));
  const picking = useStartPicking(number);
  const ship = useShipOrder(number);
  const deliver = useDeliverOrder(number);
  const cancel = useCancelOrder(number);
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
          {order.payment_status === 'approved' &&
            'O pagamento já tinha sido aprovado: o estorno ainda é manual.'}
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
              ? `${order.payment.method === 'pix' ? 'Pix' : order.payment.method === 'card' ? 'Cartão' : 'Boleto'} · ${order.payment_status === 'pending' ? 'pendente' : 'aprovado'}`
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
