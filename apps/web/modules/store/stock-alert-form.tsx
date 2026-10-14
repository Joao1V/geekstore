'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BellRing } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, FieldInput } from '@/components/ui';
import { getErrorMessage } from './lib/errors';
import { useStockAlert } from './services/engagement/mutations';
import { useCustomerStore } from './state/customer-store';

const schema = z.object({ email: z.string().trim().email('E-mail inválido') });
type Values = z.infer<typeof schema>;

/** "Avise-me quando chegar" para um SKU esgotado (RF-VIT-09). */
export function StockAlertForm({ skuId }: { skuId: string }) {
  const customer = useCustomerStore((state) => state.customer);
  const alert = useStockAlert();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { email: customer?.email ?? '' },
  });

  const submit = async (values: Values) => {
    setError('');
    try {
      await alert.mutateAsync({ sku_id: skuId, email: values.email });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (done) {
    return (
      <p role="status" className="notice my-3 flex items-center gap-2 p-3 text-sm">
        <BellRing size={18} aria-hidden="true" /> Combinado! Avisamos por e-mail quando chegar.
      </p>
    );
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="notice my-3 grid gap-3 p-4" noValidate>
      <p className="m-0 flex items-center gap-2 text-sm font-extrabold">
        <BellRing size={18} aria-hidden="true" /> Avise-me quando chegar
      </p>
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
          />
        )}
      />
      {error && (
        <p role="alert" className="error m-0 text-xs">
          {error}
        </p>
      )}
      <Action type="submit" disabled={alert.isPending}>
        {alert.isPending ? 'Salvando…' : 'Avisar-me'}
      </Action>
    </form>
  );
}
