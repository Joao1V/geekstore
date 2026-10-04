'use client';

import { type Address, onlyDigits, shippingAddressSchema } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, FieldInput, FieldSelect } from '@/components/ui';
import { BRAZILIAN_STATES } from '../checkout/constants';
import { getErrorMessage } from '../lib/errors';
import { lookupZip } from '../services/checkout/queries';
import {
  useCreateAddress,
  useDeleteAddress,
  useUpdateAddress,
} from '../services/customer/mutations';
import { addressesQuery } from '../services/customer/queries';

const ZIP_DIGITS = 8;
const formSchema = z.object({
  recipient: z.string().trim().min(2, 'Informe quem recebe'),
  zip: z.string().refine((value) => onlyDigits(value).length === ZIP_DIGITS, 'CEP com 8 dígitos'),
  street: z.string().trim().min(2, 'Informe a rua'),
  number: z.string().trim().min(1, 'Informe o número'),
  complement: z.string(),
  neighborhood: z.string().trim().min(2, 'Informe o bairro'),
  city: z.string().trim().min(2, 'Informe a cidade'),
  state: z.string().min(1, 'Escolha o estado'),
});
type Values = z.infer<typeof formSchema>;
const EMPTY: Values = {
  recipient: '',
  zip: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};

function AddressForm({ onDone }: { onDone: () => void }) {
  const create = useCreateAddress();
  const [error, setError] = useState('');
  const { control, handleSubmit, setValue, getValues } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
  });

  const fillFromZip = async () => {
    const digits = onlyDigits(getValues('zip'));
    if (digits.length !== ZIP_DIGITS) return;
    try {
      const found = await lookupZip(digits);
      setValue('street', found.street || getValues('street'));
      setValue('neighborhood', found.neighborhood || getValues('neighborhood'));
      setValue('city', found.city);
      setValue('state', found.state);
    } catch {
      // CEP não encontrado ou serviço fora: preenche à mão.
    }
  };

  const submit = async (values: Values) => {
    setError('');
    const parsed = shippingAddressSchema.safeParse({
      ...values,
      complement: values.complement || null,
    });
    if (!parsed.success) {
      setError('Confira os campos do endereço.');
      return;
    }
    try {
      await create.mutateAsync({ ...parsed.data, is_default: false });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="surface grid gap-5 p-[24px]" noValidate>
      <h3 className="text-lg font-black">Novo endereço</h3>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <Controller
          control={control}
          name="recipient"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Quem recebe"
              autoComplete="name"
            />
          )}
        />
        <Controller
          control={control}
          name="zip"
          render={({ field, fieldState }) => (
            <FieldInput
              field={{
                ...field,
                onBlur: () => {
                  field.onBlur();
                  fillFromZip();
                },
              }}
              fieldState={fieldState}
              label="CEP"
              inputMode="numeric"
              maxLength={9}
              description="Preenchemos o endereço pelo CEP."
            />
          )}
        />
        <Controller
          control={control}
          name="street"
          render={({ field, fieldState }) => (
            <FieldInput field={field} fieldState={fieldState} label="Rua" />
          )}
        />
        <Controller
          control={control}
          name="number"
          render={({ field, fieldState }) => (
            <FieldInput field={field} fieldState={fieldState} label="Número" />
          )}
        />
        <Controller
          control={control}
          name="complement"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Complemento (opcional)"
              required={false}
            />
          )}
        />
        <Controller
          control={control}
          name="neighborhood"
          render={({ field, fieldState }) => (
            <FieldInput field={field} fieldState={fieldState} label="Bairro" />
          )}
        />
        <Controller
          control={control}
          name="city"
          render={({ field, fieldState }) => (
            <FieldInput field={field} fieldState={fieldState} label="Cidade" />
          )}
        />
        <Controller
          control={control}
          name="state"
          render={({ field, fieldState }) => (
            <FieldSelect
              field={field}
              fieldState={fieldState}
              label="Estado (UF)"
              options={BRAZILIAN_STATES}
            />
          )}
        />
      </div>
      {error && (
        <p role="alert" className="error m-0">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Action type="submit" disabled={create.isPending}>
          {create.isPending ? 'Salvando…' : 'Salvar endereço'}
        </Action>
        <Action type="button" className="action-outline" onPress={onDone}>
          Cancelar
        </Action>
      </div>
    </form>
  );
}

function AddressCard({ address }: { address: Address }) {
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  return (
    <article className="surface grid gap-1 p-[20px]">
      <div className="flex items-center justify-between gap-3">
        <strong className="flex items-center gap-2 text-sm">
          <MapPin size={16} aria-hidden="true" /> {address.recipient}
        </strong>
        {address.is_default && (
          <span className="rounded-full bg-geek-yellow px-2.5 py-0.5 text-2xs font-extrabold text-ink uppercase">
            Padrão
          </span>
        )}
      </div>
      <p className="m-0 text-sm">
        {address.street}, {address.number}
        {address.complement ? ` · ${address.complement}` : ''}
      </p>
      <p className="muted m-0 text-sm">
        {address.neighborhood} · {address.city} – {address.state} · CEP {address.zip}
      </p>
      <div className="mt-2 flex gap-3 text-sm font-extrabold">
        {!address.is_default && (
          <button
            type="button"
            className="underline"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: address.address_id, body: { is_default: true } })}
          >
            Tornar padrão
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-status-error"
          disabled={remove.isPending}
          onClick={() => remove.mutate(address.address_id)}
        >
          <Trash2 size={14} /> Apagar
        </button>
      </div>
    </article>
  );
}

export function AccountAddresses() {
  const { data, isPending, error } = useQuery(addressesQuery());
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">Endereços</h2>
        {!adding && (
          <Action onPress={() => setAdding(true)}>
            <Plus size={17} /> Novo endereço
          </Action>
        )}
      </div>
      {adding && <AddressForm onDone={() => setAdding(false)} />}
      {isPending && <p className="muted">Carregando…</p>}
      {error && (
        <p role="alert" className="error">
          {getErrorMessage(error)}
        </p>
      )}
      {data?.length === 0 && !adding && (
        <p className="muted">Você ainda não salvou endereços. Eles agilizam a próxima compra.</p>
      )}
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {data?.map((address) => (
          <AddressCard key={address.address_id} address={address} />
        ))}
      </div>
    </div>
  );
}
