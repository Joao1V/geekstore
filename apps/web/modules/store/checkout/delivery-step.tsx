'use client';

import type { ShippingOption } from '@geekstore/shared';
import { onlyDigits } from '@geekstore/shared';
import { Truck } from 'lucide-react';
import { type Control, Controller } from 'react-hook-form';

import { FieldInput, FieldSelect } from '@/components/ui';
import { formatBRL } from '../lib/money';
import {
  BRAZILIAN_STATES,
  CHECKOUT_TITLE,
  CHOICE_HINT,
  CHOICE_LABEL,
  CHOICE_LIST,
  FORM_GRID,
} from './constants';
import type { CheckoutFormValues } from './schema';

const ZIP_DIGITS = 8;
const PICKUP: ShippingOption = {
  code: 'pickup',
  carrier: 'GeekStore',
  service: 'Retirar na loja (Barretos – SP)',
  price_cents: 0,
  days_min: 1,
  days_max: 2,
  free: false,
};

const days = (option: ShippingOption) =>
  option.days_min === option.days_max
    ? `${option.days_min} dia útil`
    : `${option.days_min} a ${option.days_max} dias úteis`;

/** Etapa 2: onde entregar. O CEP preenche o endereço e libera as opções de frete do servidor. */
export function DeliveryStep({
  control,
  options,
  zip,
  quoting,
  quoteError,
  isPickup,
  onZipBlur,
}: {
  control: Control<CheckoutFormValues>;
  options: ShippingOption[] | undefined;
  zip: string;
  quoting: boolean;
  quoteError: boolean;
  isPickup: boolean;
  onZipBlur: () => void;
}) {
  const ready = onlyDigits(zip).length === ZIP_DIGITS;
  const list = options ?? [PICKUP];
  return (
    <>
      <h2 className={CHECKOUT_TITLE}>Onde sua coleção vai chegar?</h2>
      {!isPickup && (
        <div className={FORM_GRID}>
          <Controller
            control={control}
            name="zip"
            render={({ field, fieldState }) => (
              <FieldInput
                field={{
                  ...field,
                  onBlur: () => {
                    field.onBlur();
                    onZipBlur();
                  },
                }}
                fieldState={fieldState}
                label="CEP"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={9}
                description="Preenchemos o endereço pelo CEP."
              />
            )}
          />
          <Controller
            control={control}
            name="street"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Rua"
                autoComplete="address-line1"
              />
            )}
          />
          <Controller
            control={control}
            name="number"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Número" autoComplete="off" />
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
                autoComplete="address-line2"
              />
            )}
          />
          <Controller
            control={control}
            name="neighborhood"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Bairro" autoComplete="off" />
            )}
          />
          <Controller
            control={control}
            name="city"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Cidade"
                autoComplete="address-level2"
              />
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
      )}
      <h3 className="mt-6 flex items-center gap-2 text-base font-black">
        <Truck size={18} /> Forma de entrega
      </h3>
      {!ready && !isPickup && (
        <p className="muted text-sm">Informe o CEP para ver o frete e o prazo.</p>
      )}
      {quoting && <p className="muted text-sm">Calculando o frete…</p>}
      {quoteError && (
        <p role="alert" className="error text-sm">
          Não consegui calcular o frete agora. Confira o carrinho e o CEP.
        </p>
      )}
      <Controller
        control={control}
        name="shipping_service"
        render={({ field }) => (
          <fieldset className={CHOICE_LIST}>
            <legend className="sr-only">Forma de entrega</legend>
            {(ready || isPickup ? list : [PICKUP]).map((option) => (
              <label key={option.code} className={CHOICE_LABEL}>
                <input
                  type="radio"
                  name={field.name}
                  value={option.code}
                  checked={field.value === option.code}
                  onChange={() => field.onChange(option.code)}
                />
                <span className="flex-1">
                  <strong>
                    {option.carrier === 'GeekStore'
                      ? option.service
                      : `${option.service} · ${option.carrier}`}
                  </strong>
                  <small className={CHOICE_HINT}>
                    {days(option)}
                    {option.free ? ' · frete grátis' : ''}
                  </small>
                </span>
                <strong>
                  {option.price_cents === 0 ? 'Grátis' : formatBRL(option.price_cents)}
                </strong>
              </label>
            ))}
          </fieldset>
        )}
      />
    </>
  );
}
