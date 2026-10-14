'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, FieldInput } from '@/components/ui';
import { getErrorMessage } from './lib/errors';
import { useSubscribeNewsletter } from './services/engagement/mutations';

const schema = z.object({ email: z.string().trim().email('E-mail inválido') });
type Values = z.infer<typeof schema>;

/** Inscrição na newsletter (RF-VIT-08): manda um e-mail de confirmação antes de valer. */
export function NewsletterForm() {
  const subscribe = useSubscribeNewsletter();
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const submit = async (values: Values) => {
    setError('');
    try {
      await subscribe.mutateAsync(values.email);
      setSentTo(values.email);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (sentTo) {
    return (
      <p role="status" className="my-3 text-sm leading-[1.6] text-night-fg">
        Quase lá! Enviamos um e-mail para <strong>{sentTo}</strong>. Clique no link para confirmar.
      </p>
    );
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-2" noValidate>
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <FieldInput
            field={field}
            fieldState={fieldState}
            label="Seu e-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            hideLabel
          />
        )}
      />
      {error && (
        <p role="alert" className="error m-0 text-xs">
          {error}
        </p>
      )}
      <Action type="submit" disabled={subscribe.isPending}>
        {subscribe.isPending ? 'Enviando…' : 'Quero receber'}
      </Action>
    </form>
  );
}
