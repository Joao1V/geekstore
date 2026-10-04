'use client';

import Link from 'next/link';
import { type Control, Controller } from 'react-hook-form';

import { FieldInput } from '@/components/ui';
import { useCustomerStore } from '../state/customer-store';
import { CHECKOUT_TITLE, FORM_GRID } from './constants';
import type { CheckoutFormValues } from './schema';

/** Etapa 1: quem compra. Quem tem conta entra antes para o pedido cair no histórico. */
export function ContactStep({ control }: { control: Control<CheckoutFormValues> }) {
  const customer = useCustomerStore((state) => state.customer);
  return (
    <>
      <h2 className={CHECKOUT_TITLE}>Como podemos falar com você?</h2>
      {customer ? (
        <p className="muted text-sm">
          Comprando como <strong>{customer.email}</strong>. O pedido fica no seu histórico.
        </p>
      ) : (
        <p className="muted text-sm">
          Continue como visitante. Já tem conta?{' '}
          <Link className="orange font-extrabold" href="/entrar/?next=/checkout/">
            Entrar
          </Link>
        </p>
      )}
      <div className={FORM_GRID}>
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
      </div>
    </>
  );
}
