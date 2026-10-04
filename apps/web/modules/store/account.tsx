'use client';

import { isValidDocument, onlyDigits } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, FieldInput } from '@/components/ui';
import { getMascot } from '@/lib/mascot';
import { getErrorMessage } from './lib/errors';
import { useLogin, useRegister } from './services/customer/mutations';
import { useCustomerStore } from './state/customer-store';

const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_NEXT = '/conta/';

/** Só caminhos da própria loja: `?next=https://outro-site` não pode virar redirecionamento aberto. */
function safeNext(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : DEFAULT_NEXT;
}

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome'),
    email: z.string().trim().email('E-mail inválido'),
    document: z
      .string()
      .refine(
        (value) => onlyDigits(value) === '' || isValidDocument(value),
        'CPF ou CNPJ inválido'
      ),
    phone: z.string().refine((value) => {
      const digits = onlyDigits(value);
      return digits === '' || (digits.length >= 10 && digits.length <= 13);
    }, 'Telefone inválido'),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'As senhas devem ser iguais.',
    path: ['confirm'],
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function LoginForm({ onDone }: { onDone: () => void }) {
  const login = useLogin();
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = async (values: LoginValues) => {
    setError('');
    try {
      await login.mutateAsync(values);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
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
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <FieldInput
            field={field}
            fieldState={fieldState}
            label="Senha"
            type="password"
            autoComplete="current-password"
          />
        )}
      />
      {error && (
        <p role="alert" className="error m-0">
          {error}
        </p>
      )}
      <Action type="submit" className="full" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'} <ArrowRight size={18} />
      </Action>
    </form>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const register = useRegister();
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', document: '', phone: '', password: '', confirm: '' },
  });

  const submit = async (values: RegisterValues) => {
    setError('');
    try {
      await register.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
        document: values.document,
        phone: values.phone,
      });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="my-[26px] grid gap-5" noValidate>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FieldInput field={field} fieldState={fieldState} label="Nome" autoComplete="name" />
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
            autoComplete="email"
          />
        )}
      />
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Controller
          control={control}
          name="document"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="CPF ou CNPJ (opcional)"
              required={false}
              inputMode="numeric"
              autoComplete="off"
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
              label="Telefone (opcional)"
              type="tel"
              required={false}
              autoComplete="tel"
            />
          )}
        />
      </div>
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <FieldInput
            field={field}
            fieldState={fieldState}
            label={`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
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
          {error}
        </p>
      )}
      <Action type="submit" className="full" disabled={register.isPending}>
        {register.isPending ? 'Criando conta…' : 'Criar conta'} <ArrowRight size={18} />
      </Action>
    </form>
  );
}

export function Account({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const status = useCustomerStore((state) => state.status);
  const suffix = params.get('next') ? `?next=${encodeURIComponent(next)}` : '';

  // Quem já está logado não precisa ver esta tela.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  return (
    <section className="wrap section">
      <div className="mx-auto grid max-w-[1040px] grid-cols-[1fr_1.05fr] overflow-hidden rounded-[22px] border-2 border-ink [box-shadow:8px_8px_var(--ink-shadow)] max-md:grid-cols-1">
        <div className="relative min-h-[670px] overflow-hidden bg-geek-yellow p-[38px] text-ink max-md:min-h-[210px] max-md:p-[25px]">
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
              ? 'Uma conta para acompanhar seus pedidos e comprar mais rápido.'
              : 'Seus pedidos, endereços e favoritos esperam por você.'}
          </p>
          {register ? (
            <RegisterForm onDone={() => router.replace(next)} />
          ) : (
            <LoginForm onDone={() => router.replace(next)} />
          )}
          <p className="muted text-sm">
            {register ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
            <Link className="orange" href={`${register ? '/entrar/' : '/cadastro/'}${suffix}`}>
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
