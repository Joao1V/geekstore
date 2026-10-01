'use client';

import type { AdminUser, AdminUserBody, AdminUserUpdateBody } from '@geekstore/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminUserBody) => adminApi.post<AdminUser>('/api/users', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ user_id, body }: { user_id: string; body: AdminUserUpdateBody }) =>
      adminApi.patch<AdminUser>(`/api/users/${user_id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.delete<void>(`/api/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}
