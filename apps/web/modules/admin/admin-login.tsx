'use client';

import { type AuthLoginBody, authLoginBodySchema } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Action, FieldInput } from '@/components/ui';
import { useLogin } from './services/auth/mutations';
import { useAdminAuthStore } from './state/auth-store';

export function AdminLogin() {
  const router = useRouter();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const [formError, setFormError] = useState('');
  const login = useLogin();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AuthLoginBody>({ resolver: zodResolver(authLoginBodySchema) });

  const submit = async (data: AuthLoginBody) => {
    setFormError('');
    try {
      const session = await login.mutateAsync(data);
      setSession(session.accessToken, session.user);
      router.replace('/admin/');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    }
  };

  return (
    <section className="wrap section admin-login">
      <div className="surface admin-login-card">
        <p className="eyebrow orange">GeekStore Studio</p>
        <h1 className="section-title">Entrar no painel</h1>
        <form onSubmit={handleSubmit(submit)}>
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
                label="Senha"
                type="password"
                autoComplete="off"
              />
            )}
          />
          {formError && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}
          <Action type="submit" className="full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'} <ArrowRight size={18} />
          </Action>
        </form>
      </div>
    </section>
  );
}
