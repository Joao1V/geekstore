'use client';

import { type Control, Controller } from 'react-hook-form';

import { FieldInput, FieldSelect } from '@/components/ui';
import { formatBRL } from '../lib/money';
import { CHECKOUT_TITLE, CHOICE_HINT, CHOICE_LABEL, CHOICE_LIST, FORM_GRID } from './constants';
import type { CheckoutFormValues } from './schema';

const METHODS = [
  { value: 'pix', title: 'Pix', hint: '5% de desconto. Aprovação em instantes.' },
  { value: 'card', title: 'Cartão de crédito', hint: 'Parcelamento sem juros.' },
  {
    value: 'boleto',
    title: 'Boleto bancário',
    hint: 'Vence em 2 dias; o estoque fica reservado até lá.',
  },
] as const;

/** Etapa 3: forma de pagamento. O número do cartão vira um token no navegador e nunca é enviado. */
export function PaymentStep({
  control,
  method,
  maxInstallments,
  totalCents,
}: {
  control: Control<CheckoutFormValues>;
  method: CheckoutFormValues['method'];
  maxInstallments: number;
  totalCents: number;
}) {
  const installments = Array.from({ length: maxInstallments }, (_, index) => {
    const count = index + 1;
    const value = formatBRL(Math.round(totalCents / count));
    return {
      value: String(count),
      label: count === 1 ? `1x de ${value} (à vista)` : `${count}x de ${value} sem juros`,
    };
  });
  return (
    <>
      <h2 className={CHECKOUT_TITLE}>Como prefere pagar?</h2>
      <Controller
        control={control}
        name="method"
        render={({ field }) => (
          <fieldset className={CHOICE_LIST}>
            <legend className="sr-only">Forma de pagamento</legend>
            {METHODS.map((option) => (
              <label key={option.value} className={CHOICE_LABEL}>
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  checked={field.value === option.value}
                  onChange={() => field.onChange(option.value)}
                />
                <span>
                  <strong>{option.title}</strong>
                  <small className={CHOICE_HINT}>{option.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      />
      {method === 'card' && (
        <>
          <div className={FORM_GRID}>
            <Controller
              control={control}
              name="card_number"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Número do cartão"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={23}
                />
              )}
            />
            <Controller
              control={control}
              name="card_holder"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Nome como no cartão"
                  autoComplete="cc-name"
                />
              )}
            />
            <Controller
              control={control}
              name="card_expiry"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Validade (MM/AA)"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={5}
                />
              )}
            />
            <Controller
              control={control}
              name="card_cvv"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="CVV"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                />
              )}
            />
            <Controller
              control={control}
              name="installments"
              render={({ field, fieldState }) => (
                <FieldSelect
                  field={field}
                  fieldState={fieldState}
                  label="Parcelas"
                  options={installments}
                />
              )}
            />
          </div>
          <p className="notice">
            Ambiente de teste: use 4242 4242 4242 4242 para aprovar ou 4000 0000 0000 0002 para
            recusar. Qualquer validade futura e CVV. O número do cartão não sai do seu navegador.
          </p>
        </>
      )}
      {method === 'pix' && (
        <p className="notice">
          Depois de finalizar, mostramos o código Pix para você copiar e pagar.
        </p>
      )}
      {method === 'boleto' && (
        <p className="notice">Depois de finalizar, mostramos a linha digitável do boleto.</p>
      )}
    </>
  );
}
