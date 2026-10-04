import type { Customer } from '@geekstore/shared';
import { create } from 'zustand';

type CustomerStatus = 'idle' | 'loading' | 'authenticated' | 'guest';

type CustomerState = {
  accessToken: string | null;
  customer: Customer | null;
  status: CustomerStatus;
  setSession: (accessToken: string, customer: Customer) => void;
  setCustomer: (customer: Customer) => void;
  clearSession: () => void;
  setStatus: (status: CustomerStatus) => void;
};

// Sem persist de propósito: o token de acesso é curto e só vive em memória. Ao recarregar, o
// `CustomerSessionBootstrap` reata a sessão pelo cookie HttpOnly do refresh token.
export const useCustomerStore = create<CustomerState>((set) => ({
  accessToken: null,
  customer: null,
  status: 'idle',
  setSession: (accessToken, customer) => set({ accessToken, customer, status: 'authenticated' }),
  setCustomer: (customer) => set({ customer }),
  clearSession: () => set({ accessToken: null, customer: null, status: 'guest' }),
  setStatus: (status) => set({ status }),
}));
