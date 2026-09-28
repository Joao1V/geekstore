'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { refreshSession } from './lib/auth-client';
import { useAdminAuthStore } from './state/auth-store';

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAdminAuthStore((state) => state.status);
  const setSession = useAdminAuthStore((state) => state.setSession);
  const setStatus = useAdminAuthStore((state) => state.setStatus);

  useEffect(() => {
    if (status !== 'idle') return;
    setStatus('loading');
    refreshSession()
      .then((session) => setSession(session.accessToken, session.user))
      .catch(() => {
        useAdminAuthStore.getState().clearSession();
        router.replace('/admin/entrar/');
      });
  }, [status, setSession, setStatus, router]);

  if (status === 'authenticated') return <>{children}</>;
  return <p className="wrap section">Verificando sessão…</p>;
}
