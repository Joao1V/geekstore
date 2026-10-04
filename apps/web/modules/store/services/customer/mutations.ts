'use client';

import type {
  Address,
  AddressBody,
  AddressUpdateBody,
  Customer,
  CustomerLoginBody,
  CustomerRegisterBody,
  CustomerSession,
  CustomerUpdateBody,
} from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { customerApi } from '../../lib/customer-api';
import { useCustomerStore } from '../../state/customer-store';
import { customerKeys } from './keys';

/** Entrou (ou criou a conta): guarda o token em memória e o cliente no store. */
function storeSession(session: CustomerSession) {
  useCustomerStore.getState().setSession(session.access_token, session.customer);
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: CustomerRegisterBody) =>
      api.post<CustomerSession>('/api/customer/auth/register', body),
    onSuccess: storeSession,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: CustomerLoginBody) =>
      api.post<CustomerSession>('/api/customer/auth/login', body),
    onSuccess: storeSession,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/api/customer/auth/logout'),
    onSettled: () => {
      useCustomerStore.getState().clearSession();
      // Nada da conta anterior pode sobrar na tela.
      queryClient.removeQueries({ queryKey: ['customer'] });
    },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: CustomerUpdateBody) => customerApi.patch<Customer>('/api/customer/me', body),
    onSuccess: (customer) => useCustomerStore.getState().setCustomer(customer),
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddressBody) => customerApi.post<Address>('/api/customer/addresses', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.addresses }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddressUpdateBody }) =>
      customerApi.patch<Address>(`/api/customer/addresses/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.addresses }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerApi.delete<void>(`/api/customer/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.addresses }),
  });
}
