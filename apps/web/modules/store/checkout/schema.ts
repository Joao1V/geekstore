import { isFutureExpiry, isValidDocument, mockCardToken, onlyDigits } from '@geekstore/shared';
import { z } from 'zod';

const ZIP_DIGITS = 8;

/** Todos os campos do checkout; o que vale em cada etapa é conferido na hora de avançar. */
export const checkoutFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome'),
    email: z.string().trim().email('E-mail inválido'),
    phone: z.string().refine((value) => {
      const digits = onlyDigits(value);
      return digits === '' || (digits.length >= 10 && digits.length <= 13);
    }, 'Telefone inválido'),
    document: z
      .string()
      .refine(
        (value) => onlyDigits(value) === '' || isValidDocument(value),
        'CPF ou CNPJ inválido'
      ),
    shipping_service: z.enum(['standard', 'express', 'pickup']),
    zip: z.string(),
    street: z.string(),
    number: z.string(),
    complement: z.string(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string(),
    method: z.enum(['pix', 'card', 'boleto']),
    installments: z.string(),
    card_number: z.string(),
    card_holder: z.string(),
    card_expiry: z.string(),
    card_cvv: z.string(),
    save_address: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: keyof typeof values, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (values.shipping_service !== 'pickup') {
      if (onlyDigits(values.zip).length !== ZIP_DIGITS) fail('zip', 'CEP com 8 dígitos');
      if (!values.street.trim()) fail('street', 'Informe a rua');
      if (!values.number.trim()) fail('number', 'Informe o número');
      if (!values.neighborhood.trim()) fail('neighborhood', 'Informe o bairro');
      if (!values.city.trim()) fail('city', 'Informe a cidade');
      if (!values.state) fail('state', 'Escolha o estado');
    }
    if (values.method === 'card') {
      if (!mockCardToken(values.card_number)) fail('card_number', 'Número de cartão inválido');
      if (!values.card_holder.trim()) fail('card_holder', 'Nome como no cartão');
      if (!isFutureExpiry(values.card_expiry)) fail('card_expiry', 'Validade inválida');
      if (!/^\d{3,4}$/.test(values.card_cvv.trim())) fail('card_cvv', 'CVV inválido');
    }
  });

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export const STEP_FIELDS: Record<number, (keyof CheckoutFormValues)[]> = {
  0: ['name', 'email', 'phone', 'document'],
  1: ['shipping_service', 'zip', 'street', 'number', 'neighborhood', 'city', 'state'],
  2: ['method', 'card_number', 'card_holder', 'card_expiry', 'card_cvv', 'installments'],
};

export const emptyCheckoutValues: CheckoutFormValues = {
  name: '',
  email: '',
  phone: '',
  document: '',
  shipping_service: 'standard',
  zip: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  method: 'pix',
  installments: '1',
  card_number: '',
  card_holder: '',
  card_expiry: '',
  card_cvv: '',
  save_address: false,
};
