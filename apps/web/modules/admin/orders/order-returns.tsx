'use client';

import type { Order, OrderReturn } from '@geekstore/shared';
import { PackageOpen, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Action, Dialog, FieldInput, FieldNumber } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useReceiveReturn, useRequestReturn } from '../services/orders/mutations';
import { Badge } from '../ui/badge';

const SHIPPED = ['shipped', 'partially_shipped', 'delivered'];

type RequestValues = { reason: string; quantities: Record<string, number | null> };
type ReceiveValues = {
  resellable: Record<string, number | null>;
  damaged: Record<string, number | null>;
};

/** Quanto de cada item ainda pode ser devolvido: o que foi comprado menos o que já está em devolução. */
function remainingBySku(order: Order): Map<string, number> {
  const returned = new Map<string, number>();
  for (const item of order.returns.flatMap((entry) => entry.items)) {
    returned.set(item.sku_id, (returned.get(item.sku_id) ?? 0) + item.quantity);
  }
  return new Map(
    order.items.map((item) => [item.sku_id, item.quantity - (returned.get(item.sku_id) ?? 0)])
  );
}

/** Devoluções do pedido (RF-PED-04): pedir, receber e avaliar. O dinheiro é estornado à parte. */
export function OrderReturns({ order, canWrite }: { order: Order; canWrite: boolean }) {
  const request = useRequestReturn(order.number);
  const receive = useReceiveReturn(order.number);
  const [dialog, setDialog] = useState<'request' | { receiving: OrderReturn } | null>(null);
  const [error, setError] = useState('');
  const remaining = remainingBySku(order);
  const canRequest =
    canWrite &&
    order.status !== 'cancelled' &&
    SHIPPED.includes(order.fulfillment_status) &&
    [...remaining.values()].some((value) => value > 0);

  const requestForm = useForm<RequestValues>({ defaultValues: { reason: '', quantities: {} } });
  const receiveForm = useForm<ReceiveValues>({ defaultValues: { resellable: {}, damaged: {} } });

  if (!order.returns.length && !canRequest) return null;

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      setDialog(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const openRequest = () => {
    requestForm.reset({
      reason: '',
      quantities: Object.fromEntries(order.items.map((item) => [item.sku_id, null])),
    });
    setDialog('request');
  };
  const openReceive = (target: OrderReturn) => {
    receiveForm.reset({
      resellable: Object.fromEntries(target.items.map((item) => [item.sku_id, item.quantity])),
      damaged: Object.fromEntries(target.items.map((item) => [item.sku_id, 0])),
    });
    setDialog({ receiving: target });
  };

  const submitRequest = requestForm.handleSubmit((values) => {
    const items = order.items
      .map((item) => ({ sku_id: item.sku_id, quantity: values.quantities[item.sku_id] ?? 0 }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      setError('Escolha a quantidade de ao menos um item.');
      return;
    }
    if (values.reason.trim().length < 3) {
      requestForm.setError('reason', { message: 'Diga o motivo da devolução' });
      return;
    }
    return run(() => request.mutateAsync({ reason: values.reason.trim(), items }));
  });

  const receiving = typeof dialog === 'object' && dialog ? dialog.receiving : null;
  const submitReceive = receiveForm.handleSubmit((values) => {
    if (!receiving) return;
    const items = receiving.items.map((item) => ({
      sku_id: item.sku_id,
      resellable_quantity: values.resellable[item.sku_id] ?? 0,
      damaged_quantity: values.damaged[item.sku_id] ?? 0,
    }));
    const wrong = receiving.items.find((item, index) => {
      const evaluated = items[index];
      return (
        !evaluated || evaluated.resellable_quantity + evaluated.damaged_quantity !== item.quantity
      );
    });
    if (wrong) {
      setError(`Em ${wrong.sku_code}, vendável mais danificado deve somar ${wrong.quantity}.`);
      return;
    }
    return run(() => receive.mutateAsync({ returnId: receiving.order_return_id, body: { items } }));
  });

  return (
    <div className="surface mt-4 p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-base font-extrabold">Devoluções</h2>
        {canRequest && (
          <Action className="action-outline" onPress={openRequest}>
            <Undo2 size={16} /> Registrar devolução
          </Action>
        )}
      </div>
      {error && !dialog && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul className="m-0 grid list-none gap-3 p-0">
        {order.returns.map((entry) => (
          <li
            key={entry.order_return_id}
            className="flex flex-wrap items-start justify-between gap-3"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={entry.status === 'received' ? 'success' : 'warning'}>
                  {entry.status === 'received' ? 'Recebida' : 'Aguardando a mercadoria'}
                </Badge>
                <span className="muted">
                  {formatDateTime(entry.created_at)} · {entry.reason}
                </span>
              </div>
              <ul className="muted mt-1 mb-0 list-none p-0 text-xs">
                {entry.items.map((item) => (
                  <li key={item.sku_id}>
                    {item.quantity}x {item.name}
                    {entry.status === 'received' &&
                      ` — vendável ${item.resellable_quantity ?? 0} · quarentena ${item.damaged_quantity ?? 0}`}
                  </li>
                ))}
              </ul>
            </div>
            {canWrite && entry.status === 'requested' && (
              <Action className="action-outline" onPress={() => openReceive(entry)}>
                <PackageOpen size={16} /> Receber
              </Action>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={dialog === 'request'}
        onChange={(next) => !next && setDialog(null)}
        title="Registrar devolução"
      >
        <form className="grid gap-4" noValidate onSubmit={submitRequest}>
          <p className="m-0 text-sm">
            Informe o que o cliente vai devolver. O estoque só muda quando a mercadoria chegar e for
            avaliada. O estorno do dinheiro é feito à parte, em Estornar.
          </p>
          {order.items.map((item) => {
            const left = remaining.get(item.sku_id) ?? 0;
            return (
              <Controller
                key={item.sku_id}
                control={requestForm.control}
                name={`quantities.${item.sku_id}`}
                render={({ field, fieldState }) => (
                  <FieldNumber
                    field={field}
                    fieldState={fieldState}
                    label={`${item.name} (comprou ${item.quantity}, pode devolver até ${left})`}
                    required={false}
                    minValue={0}
                    maxValue={left}
                    step={1}
                    isDisabled={left <= 0}
                  />
                )}
              />
            );
          })}
          <Controller
            control={requestForm.control}
            name="reason"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Motivo da devolução" />
            )}
          />
          {error && (
            <p className="error m-0" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Action type="button" className="action-outline" onPress={() => setDialog(null)}>
              Voltar
            </Action>
            <Action type="submit" disabled={request.isPending}>
              {request.isPending ? 'Registrando…' : 'Registrar devolução'}
            </Action>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={receiving !== null}
        onChange={(next) => !next && setDialog(null)}
        title="Receber devolução"
      >
        <form className="grid gap-4" noValidate onSubmit={submitReceive}>
          <p className="m-0 text-sm">
            Avalie cada item. O que está em condição de venda volta ao depósito; o resto vai para a
            quarentena e não aparece para venda.
          </p>
          {receiving?.items.map((item) => (
            <div key={item.sku_id} className="grid gap-2">
              <strong>
                {item.name} <span className="muted font-normal">(devolvendo {item.quantity})</span>
              </strong>
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  control={receiveForm.control}
                  name={`resellable.${item.sku_id}`}
                  render={({ field, fieldState }) => (
                    <FieldNumber
                      field={field}
                      fieldState={fieldState}
                      label="Em condição de venda"
                      minValue={0}
                      maxValue={item.quantity}
                      step={1}
                    />
                  )}
                />
                <Controller
                  control={receiveForm.control}
                  name={`damaged.${item.sku_id}`}
                  render={({ field, fieldState }) => (
                    <FieldNumber
                      field={field}
                      fieldState={fieldState}
                      label="Sem condição (quarentena)"
                      minValue={0}
                      maxValue={item.quantity}
                      step={1}
                    />
                  )}
                />
              </div>
            </div>
          ))}
          {error && (
            <p className="error m-0" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Action type="button" className="action-outline" onPress={() => setDialog(null)}>
              Voltar
            </Action>
            <Action type="submit" disabled={receive.isPending}>
              {receive.isPending ? 'Recebendo…' : 'Confirmar recebimento'}
            </Action>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
