'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Action, Field } from '@/components/ui';
import { login } from './lib/auth-client';
import { useAdminAuthStore } from './state/auth-store';

const MIN_PASSWORD_LENGTH = 8;

export function AdminLogin() {
  const router = useRouter();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      const session = await login({
        email: String(data.get('email')),
        password: String(data.get('password')),
      });
      setSession(session.accessToken, session.user);
      router.replace('/admin/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="wrap section admin-login">
      <div className="surface admin-login-card">
        <p className="eyebrow orange">GeekStore Studio</p>
        <h1 className="section-title">Entrar no painel</h1>
        <form onSubmit={submit}>
          <Field label="E-mail" name="email" type="email" autoComplete="off" />
          <Field
            label="Senha"
            name="password"
            type="password"
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="off"
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Action type="submit" className="full" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'} <ArrowRight size={18} />
          </Action>
        </form>
      </div>
    </section>
  );
}
