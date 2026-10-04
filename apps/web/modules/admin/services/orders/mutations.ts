'use client';

import type { Order, OrderCancelBody, OrderShipBody } from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

/**
 * Cada ação do pedido devolve o pedido atualizado. Enviar e cancelar mexem no estoque, então o que
 * mostra saldo também recarrega.
 */
function useOrderAction<TBody>(number: number, action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: TBody) => adminApi.post<Order>(`/api/orders/${number}/${action}`, body),
    onSuccess: (order) => {
      queryClient.setQueryData(adminKeys.orderDetail(number), order);
      for (const key of [
        adminKeys.orders,
        adminKeys.stockLevels,
        adminKeys.movements,
        adminKeys.skuGrid,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export const useStartPicking = (number: number) =>
  useOrderAction<undefined>(number, 'start-picking');
export const useShipOrder = (number: number) => useOrderAction<OrderShipBody>(number, 'ship');
export const useDeliverOrder = (number: number) => useOrderAction<undefined>(number, 'deliver');
export const useCancelOrder = (number: number) => useOrderAction<OrderCancelBody>(number, 'cancel');
