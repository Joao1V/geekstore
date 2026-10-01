'use client';

import { type AdminUser, type AdminUserBody, roleCodes } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput, FieldSelect } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCreateUser, useUpdateUser } from '../services/users/mutations';
import { ROLE_LABELS } from './role-labels';

const MIN_PASSWORD = 8;
const ROLE_OPTIONS = roleCodes.map((code) => ({ value: code, label: ROLE_LABELS[code] }));

function makeSchema(isCreate: boolean) {
  return z.object({
    name: z.string().trim().min(1, 'Informe o nome').max(255),
    email: isCreate ? z.string().email('E-mail inválido').max(255) : z.string(),
    password: isCreate
      ? z.string().min(MIN_PASSWORD, `Mínimo de ${MIN_PASSWORD} caracteres`).max(128)
      : z.string().refine((value) => !value || value.length >= MIN_PASSWORD, {
          message: `Mínimo de ${MIN_PASSWORD} caracteres`,
        }),
    role: z.enum(roleCodes),
  });
}
type UserFormValues = z.infer<ReturnType<typeof makeSchema>>;

/** `{}` = novo usuário; `{ user }` = edição; `null` = fechado. */
export type UserFormTarget = { user?: AdminUser };

export function UserForm({
  target,
  onClose,
}: {
  target: UserFormTarget | null;
  onClose: () => void;
}) {
  const editing = target?.user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [formError, setFormError] = useState('');
  const schema = useMemo(() => makeSchema(!editing), [editing]);
  const defaults = useMemo<UserFormValues>(
    () => ({
      name: editing?.name ?? '',
      email: editing?.email ?? '',
      password: '',
      role: editing?.role ?? 'viewer',
    }),
    [editing]
  );

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UserFormValues>({ resolver: zodResolver(schema), values: defaults });

  const submit = async (values: UserFormValues) => {
    setFormError('');
    try {
      if (editing) {
        await updateUser.mutateAsync({
          user_id: editing.user_id,
          body: {
            name: values.name.trim(),
            role: values.role,
            ...(values.password ? { password: values.password } : {}),
          },
        });
      } else {
        const body: AdminUserBody = {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          role: values.role,
        };
        await createUser.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={target !== null}
      onChange={(open) => !open && onClose()}
      title={editing ? 'Editar usuário' : 'Novo usuário'}
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Nome" autoComplete="off" />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="E-mail"
                type="email"
                autoComplete="off"
                disabled={Boolean(editing)}
              />
            )}
          />
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <FieldSelect
                field={field}
                fieldState={fieldState}
                label="Perfil"
                options={ROLE_OPTIONS}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label={editing ? 'Nova senha' : 'Senha'}
                description={editing ? 'Deixe em branco para manter a atual.' : undefined}
                type="password"
                autoComplete="new-password"
                required={!editing}
              />
            )}
          />
          {formError && (
            <p className="error m-0" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Action className="action-outline" onPress={onClose}>
              Cancelar
            </Action>
            <Action type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Action>
          </div>
        </form>
      )}
    </Dialog>
  );
}
