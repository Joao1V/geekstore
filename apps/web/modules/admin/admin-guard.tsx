'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useRefreshSession } from './services/auth/mutations';
import { useAdminAuthStore } from './state/auth-store';

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAdminAuthStore((state) => state.status);
  const setSession = useAdminAuthStore((state) => state.setSession);
  const setStatus = useAdminAuthStore((state) => state.setStatus);
  const { mutate: refreshSession } = useRefreshSession();

  useEffect(() => {
    // Lê o status atual do store (não o da closure): no StrictMode o efeito roda duas vezes e um
    // segundo refresh com o mesmo cookie seria tratado como reuso de token e derrubaria a sessão.
    if (useAdminAuthStore.getState().status !== 'idle') return;
    setStatus('loading');
    refreshSession(undefined, {
      onSuccess: (session) => setSession(session.access_token, session.user),
      onError: () => {
        useAdminAuthStore.getState().clearSession();
        router.replace('/admin/entrar/');
      },
    });
  }, [refreshSession, setSession, setStatus, router]);

  if (status === 'authenticated') return <>{children}</>;
  return <p className="wrap section">Verificando sessão…</p>;
}
