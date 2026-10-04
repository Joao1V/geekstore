'use client';

import { isValidDocument, onlyDigits } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, FieldInput } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useUpdateProfile } from '../services/customer/mutations';
import { useCustomerStore } from '../state/customer-store';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  document: z
    .string()
    .refine((value) => onlyDigits(value) === '' || isValidDocument(value), 'CPF ou CNPJ inválido'),
  phone: z.string().refine((value) => {
    const digits = onlyDigits(value);
    return digits === '' || (digits.length >= 10 && digits.length <= 13);
  }, 'Telefone inválido'),
});
type Values = z.infer<typeof schema>;

export function AccountProfile() {
  const customer = useCustomerStore((state) => state.customer);
  const update = useUpdateProfile();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? '',
      document: customer?.document ?? '',
      phone: customer?.phone ?? '',
    },
  });

  const submit = async (values: Values) => {
    setMessage('');
    setError('');
    try {
      await update.mutateAsync(values);
      setMessage('Dados atualizados.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="surface grid gap-5 p-[28px]" noValidate>
      <h2 className="text-xl font-black">Meus dados</h2>
      <p className="muted m-0 text-sm">
        E-mail da conta: <strong>{customer?.email}</strong>
      </p>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FieldInput field={field} fieldState={fieldState} label="Nome" autoComplete="name" />
        )}
      />
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <Controller
          control={control}
          name="document"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="CPF ou CNPJ"
              required={false}
              inputMode="numeric"
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Telefone"
              type="tel"
              required={false}
              autoComplete="tel"
            />
          )}
        />
      </div>
      {message && (
        <p role="status" className="notice m-0">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error m-0">
          {error}
        </p>
      )}
      <div>
        <Action type="submit" disabled={update.isPending}>
          {update.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Action>
      </div>
    </form>
  );
}
