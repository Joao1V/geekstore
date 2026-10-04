'use client';

import type { CheckoutBody, CouponCheck, Order } from '@geekstore/shared';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { customerApi } from '../../lib/customer-api';
import { useCustomerStore } from '../../state/customer-store';

/**
 * Cria o pedido. Quem está logado usa a sessão (o pedido entra no histórico); visitante compra sem
 * conta. A chave de idempotência evita pedido duplicado se o clique repetir ou a rede falhar.
 */
export function useCreateOrder() {
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CheckoutBody; idempotencyKey: string }) => {
      const options = { headers: { 'Idempotency-Key': idempotencyKey } };
      const authenticated = useCustomerStore.getState().status === 'authenticated';
      return authenticated
        ? customerApi.post<Order>('/api/store/checkout', body, options)
        : api.post<Order>('/api/store/checkout', body, options);
    },
  });
}

export function useCheckCoupon() {
  return useMutation({
    mutationFn: (input: { code: string; subtotal_cents: number }) =>
      api.post<CouponCheck>('/api/store/coupons/check', input),
  });
}

/** Só fora de produção: "paga" o Pix de teste no lugar do aviso do gateway. */
export function useSimulatePayment() {
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<Order>(`/api/store/orders/${orderId}/simulate-payment`),
  });
}
