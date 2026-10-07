'use client';

import { useEffect } from 'react';
import { refreshAccessToken } from './lib/customer-api';
import { useCustomerStore } from './state/customer-store';

/**
 * Ao abrir a loja, tenta reatar a sessão do cliente pelo cookie HttpOnly. Sem cookie válido a
 * pessoa segue como visitante (status "guest"); nada é pedido nem mostrado.
 */
export function CustomerSessionBootstrap() {
  useEffect(() => {
    const { status, setStatus, clearSession } = useCustomerStore.getState();
    if (status !== 'idle') return;
    setStatus('loading');
    // Mesma chamada única do customerApi: o Strict Mode roda o efeito duas vezes em desenvolvimento.
    refreshAccessToken().catch(() => clearSession());
  }, []);
  return null;
}
