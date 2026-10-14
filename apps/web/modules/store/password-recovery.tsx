'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, AuthSplit, FieldInput } from '@/components/ui';
import { getErrorMessage } from './lib/errors';
import { useForgotPassword, useResetPassword } from './services/customer/mutations';

const MIN_PASSWORD_LENGTH = 8;

const HEADLINE = (
  <>
    Sem
    <br />
    problema.
    <br />A gente ajuda.
  </>
);

const forgotSchema = z.object({ email: z.string().trim().email('E-mail inválido') });
type ForgotValues = z.infer<typeof forgotSchema>;

/** Pede o e-mail com o link de nova senha (RF-CLI-02). */
export function ForgotPassword() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const submit = async (values: ForgotValues) => {
    setError('');
    try {
      await forgot.mutateAsync(values.email);
      setSentTo(values.email);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthSplit
      kicker="Esqueceu a senha?"
      headline={HEADLINE}
      backHref="/entrar/"
      backLabel="Voltar ao login"
    >
      <p className="eyebrow orange">Conta GeekStore</p>
      <h1 className="section-title text-5xl max-md:text-4xl">Recuperar senha</h1>
      {sentTo ? (
        <div role="status" className="notice mt-6 flex gap-3 p-4 text-sm">
          <MailCheck className="shrink-0" size={20} />
          <p className="m-0">
            Se existe uma conta com <strong>{sentTo}</strong>, enviamos um link para criar uma nova
            senha. Ele vale por 1 hora. Confira também a caixa de spam.
          </p>
        </div>
      ) : (
        <>
          <p className="muted text-sm">
            Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
          </p>
          <form onSubmit={handleSubmit(submit)} className="my-[26px] grid gap-5" noValidate>
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                />
              )}
            />
            {error && (
              <p role="alert" className="error m-0">
                {error}
              </p>
            )}
            <Action type="submit" className="full" disabled={forgot.isPending}>
              {forgot.isPending ? 'Enviando…' : 'Enviar o link'} <ArrowRight size={18} />
            </Action>
          </form>
        </>
      )}
      <p className="muted mt-6 text-center text-sm">
        Lembrou?{' '}
        <Link className="orange" href="/entrar/">
          Voltar ao login
        </Link>
      </p>
    </AuthSplit>
  );
}

const resetSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'As senhas devem ser iguais.',
    path: ['confirm'],
  });
type ResetValues = z.infer<typeof resetSchema>;

/** Define a nova senha com o link recebido por e-mail. */
export function ResetPassword() {
  const token = useSearchParams().get('token') ?? '';
  const reset = useResetPassword();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const submit = async (values: ResetValues) => {
    setError('');
    try {
      await reset.mutateAsync({ token, password: values.password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthSplit
      kicker="Quase lá."
      headline={HEADLINE}
      backHref="/entrar/"
      backLabel="Voltar ao login"
    >
      <p className="eyebrow orange">Conta GeekStore</p>
      <h1 className="section-title text-5xl max-md:text-4xl">Nova senha</h1>
      {done ? (
        <>
          <div role="status" className="notice mt-6 p-4 text-sm">
            Senha atualizada! Por segurança, você saiu dos outros aparelhos.
          </div>
          <Link className="action full mt-6" href="/entrar/">
            Entrar <ArrowRight size={18} />
          </Link>
        </>
      ) : !token ? (
        <p role="alert" className="error mt-6">
          Este link está incompleto. Peça um novo em{' '}
          <Link className="orange" href="/esqueci-a-senha/">
            recuperar senha
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit(submit)} className="my-[26px] grid gap-5" noValidate>
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label={`Nova senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
                type="password"
                autoComplete="new-password"
              />
            )}
          />
          <Controller
            control={control}
            name="confirm"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Confirmar senha"
                type="password"
                autoComplete="new-password"
              />
            )}
          />
          {error && (
            <p role="alert" className="error m-0">
              {error}{' '}
              <Link className="orange" href="/esqueci-a-senha/">
                Pedir novo link
              </Link>
            </p>
          )}
          <Action type="submit" className="full" disabled={reset.isPending}>
            {reset.isPending ? 'Salvando…' : 'Salvar nova senha'} <ArrowRight size={18} />
          </Action>
        </form>
      )}
    </AuthSplit>
  );
}
