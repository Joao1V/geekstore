import type { AuthUser } from '@geekstore/shared';
import { create } from 'zustand';

type AdminAuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type AdminAuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  status: AdminAuthStatus;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  setStatus: (status: AdminAuthStatus) => void;
};

// Sem persist de propósito: o token de acesso é curto (15min) e só deve viver em
// memória. Recarregar a página perde o estado aqui, mas o AdminGuard já reata a
// sessão sozinho via /api/auth/refresh, usando o cookie HttpOnly do refresh token.
export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'idle',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clearSession: () => set({ accessToken: null, user: null, status: 'unauthenticated' }),
  setStatus: (status) => set({ status }),
}));
