'use client';

import type { Permission } from '@geekstore/shared';

import { useAdminAuthStore } from '../state/auth-store';

/** RBAC no cliente (só UX): o servidor continua sendo a autoridade. Lê do store Zustand. */
export function useCan(permission: Permission): boolean {
  return useAdminAuthStore((state) => state.user?.permissions.includes(permission) ?? false);
}
