'use client';

import type { AdminUser } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useUrlState } from '../lib/use-url-state';
import { useDeleteUser } from '../services/users/mutations';
import { userListQueryOptions } from '../services/users/queries';
import { useAdminAuthStore } from '../state/auth-store';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { ROLE_LABELS } from './role-labels';
import { UserForm, type UserFormTarget } from './user-form';

const PAGE_SIZE = 20;
const ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-lg border border-border bg-surface';

export function UserManager() {
  const canWrite = useCan('users:write');
  const me = useAdminAuthStore((state) => state.user);
  const { setParams, page } = useUrlState();
  const { data, isPending, error } = useQuery(
    userListQueryOptions({ page, page_size: PAGE_SIZE, sort: 'created_at:desc' })
  );
  const deleteUser = useDeleteUser();
  const [formTarget, setFormTarget] = useState<UserFormTarget | null>(null);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteError('');
    try {
      await deleteUser.mutateAsync(toDelete.user_id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Usuários"
        actions={
          canWrite && (
            <Action onPress={() => setFormTarget({})}>
              <Plus size={17} /> Novo usuário
            </Action>
          )
        }
      />
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Perfil</Th>
            <Th>Criado em</Th>
            <Th align="right">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={5}>Carregando…</EmptyRow>}
          {data?.data.map((user) => (
            <tr key={user.user_id}>
              <Td className="font-extrabold">
                {user.name}
                {user.user_id === me?.user_id && <span className="muted ml-2 text-xs">(você)</span>}
              </Td>
              <Td>{user.email}</Td>
              <Td>
                <Badge tone={user.role === 'owner' ? 'warning' : 'neutral'}>
                  {ROLE_LABELS[user.role]}
                </Badge>
              </Td>
              <Td>{formatDateTime(user.created_at)}</Td>
              <Td align="right">
                {canWrite && (
                  <span className="inline-flex gap-2">
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`Editar ${user.name}`}
                      onClick={() => setFormTarget({ user })}
                    >
                      <Pencil size={16} />
                    </button>
                    {user.user_id !== me?.user_id && (
                      <button
                        type="button"
                        className={`${ICON_BUTTON} text-status-error`}
                        aria-label={`Excluir ${user.name}`}
                        onClick={() => {
                          setDeleteError('');
                          setToDelete(user);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </span>
                )}
              </Td>
            </tr>
          ))}
          {data && !data.data.length && <EmptyRow colSpan={5}>Nenhum usuário.</EmptyRow>}
        </tbody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
      <UserForm target={formTarget} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir usuário"
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        isPending={deleteUser.isPending}
        error={deleteError}
      >
        Excluir o acesso de <strong>{toDelete?.name}</strong>? A pessoa perde o acesso ao painel.
      </ConfirmDialog>
    </>
  );
}
