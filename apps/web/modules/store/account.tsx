'use client';

import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Action, Field } from '@/components/ui';
import { getMascot } from '@/lib/mascot';

const MIN_PASSWORD_LENGTH = 8;

export function Account({ register = false }: { register?: boolean }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (register && data.get('password') !== data.get('confirm')) {
      setError('As senhas devem ser iguais.');
      setMessage('');
      return;
    }
    setError('');
    setMessage(
      'Formulário validado. A API de autenticação ainda precisa ser conectada; nenhuma conta ou sessão real foi criada.'
    );
    event.currentTarget.reset();
  };

  return (
    <section className="wrap section">
      <div className="account-layout comic-card">
        <div className="account-art">
          <Link href="/" className="back-link">
            <ArrowLeft size={17} /> Voltar para a loja
          </Link>
          <p className="eyebrow">Seu lado geek tem um lugar.</p>
          <h2>
            Entre.
            <br />O universo
            <br />é seu.
          </h2>
          <Image {...getMascot('welcome')} width={320} height={380} />
        </div>
        <div className="account-form">
          <p className="eyebrow orange">Conta GeekStore</p>
          <h1 className="section-title">
            {register ? 'Comece sua coleção' : 'Bom te ver de novo!'}
          </h1>
          <p className="muted">
            {register
              ? 'Uma conta para suas próximas histórias.'
              : 'Seus favoritos e novos achados esperam por você.'}
          </p>
          <p className="notice">
            Prévia de interface: autenticação ainda não conectada. Use apenas dados e senhas
            fictícios. Nada será enviado ou salvo.
          </p>
          <form onSubmit={submit}>
            {register && <Field label="Nome" name="name" minLength={3} autoComplete="off" />}
            <Field label="E-mail" name="email" type="email" autoComplete="off" />
            <Field
              label={`Senha de teste (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
              name="password"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="off"
            />
            {register && (
              <Field
                label="Confirmar senha"
                name="confirm"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="off"
              />
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Action type="submit" className="full">
              {register ? 'Testar cadastro' : 'Testar entrada'} <ArrowRight size={18} />
            </Action>
            {message && (
              <p role="status" className="notice flex gap-2">
                <CheckCircle2 size={20} />
                {message}
              </p>
            )}
          </form>
          <p className="muted">
            {register ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
            <Link className="orange" href={register ? '/entrar/' : '/cadastro/'}>
              {register ? 'Entrar' : 'Cadastre-se'}
            </Link>
          </p>
          <Link href="/catalogo/" className="back-link">
            Continuar sem entrar <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
