'use client';

import type { CustomerSession } from '@geekstore/shared';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useCustomerStore } from './state/customer-store';

/**
 * Ao abrir a loja, tenta reatar a sessão do cliente pelo cookie HttpOnly. Sem cookie válido a
 * pessoa segue como visitante (status "guest"); nada é pedido nem mostrado.
 */
export function CustomerSessionBootstrap() {
  const status = useCustomerStore((state) => state.status);
  useEffect(() => {
    if (status !== 'idle') return;
    const { setStatus, setSession, clearSession } = useCustomerStore.getState();
    setStatus('loading');
    api
      .post<CustomerSession>('/api/customer/auth/refresh')
      .then((session) => setSession(session.access_token, session.customer))
      .catch(() => clearSession());
  }, [status]);
  return null;
}
