'use client';

import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Action, FieldInput } from '@/components/ui';
import { getMascot } from '@/lib/mascot';

const MIN_PASSWORD_LENGTH = 8;

type AccountFormValues = {
  name?: string;
  email: string;
  password: string;
  confirm?: string;
};

export function Account({ register = false }: { register?: boolean }) {
  const [message, setMessage] = useState('');
  const { control, handleSubmit, reset, setError } = useForm<AccountFormValues>();

  const submit = (data: AccountFormValues) => {
    if (register && data.password !== data.confirm) {
      setError('confirm', { message: 'As senhas devem ser iguais.' });
      return;
    }
    setMessage(
      'Formulário validado. A API de autenticação ainda precisa ser conectada; nenhuma conta ou sessão real foi criada.'
    );
    reset();
  };

  return (
    <section className="wrap section">
      <div className="mx-auto grid max-w-[1040px] grid-cols-[1fr_1.05fr] overflow-hidden rounded-[22px] border-2 border-[#111] [box-shadow:8px_8px_var(--ink-shadow)] max-md:grid-cols-1">
        <div className="relative min-h-[670px] overflow-hidden bg-geek-yellow p-[38px] text-[#111] max-md:min-h-[210px] max-md:p-[25px]">
          <Link href="/" className="back-link max-md:mb-2.5">
            <ArrowLeft size={17} /> Voltar para a loja
          </Link>
          <p className="eyebrow mt-8 max-md:mt-[5px] max-md:text-2xs">
            Seu lado geek tem um lugar.
          </p>
          <h2 className="font-display relative z-1 my-5 text-7xl leading-[1.02] max-md:my-3.5 max-md:text-5xl max-md:leading-[0.95]">
            Entre.
            <br />O universo
            <br />é seu.
          </h2>
          <Image
            {...getMascot('welcome')}
            width={320}
            height={380}
            className="absolute -right-[5px] -bottom-[15px] h-[380px] w-[320px] object-contain max-md:right-0 max-md:-bottom-4 max-md:h-[220px] max-md:w-[185px]"
          />
        </div>
        <div className="bg-surface p-[42px] max-md:px-5 max-md:py-[25px]">
          <p className="eyebrow orange">Conta GeekStore</p>
          <h1 className="section-title text-5xl max-md:text-4xl">
            {register ? 'Comece sua coleção' : 'Bom te ver de novo!'}
          </h1>
          <p className="muted text-sm">
            {register
              ? 'Uma conta para suas próximas histórias.'
              : 'Seus favoritos e novos achados esperam por você.'}
          </p>
          <p className="notice">
            Prévia de interface: autenticação ainda não conectada. Use apenas dados e senhas
            fictícios. Nada será enviado ou salvo.
          </p>
          <form onSubmit={handleSubmit(submit)} className="my-[26px] grid gap-5">
            {register && (
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <FieldInput
                    field={field}
                    fieldState={fieldState}
                    label="Nome"
                    minLength={3}
                    autoComplete="off"
                  />
                )}
              />
            )}
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
                  label={`Senha de teste (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="off"
                />
              )}
            />
            {register && (
              <Controller
                control={control}
                name="confirm"
                render={({ field, fieldState }) => (
                  <FieldInput
                    field={field}
                    fieldState={fieldState}
                    label="Confirmar senha"
                    type="password"
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="off"
                  />
                )}
              />
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
          <p className="muted text-sm">
            {register ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
            <Link className="orange" href={register ? '/entrar/' : '/cadastro/'}>
              {register ? 'Entrar' : 'Cadastre-se'}
            </Link>
          </p>
          <Link href="/catalogo/" className="back-link mt-6">
            Continuar sem entrar <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
