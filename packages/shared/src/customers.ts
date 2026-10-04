import { z } from 'zod';

import { dataResponse, isoDateTimeSchema } from './common';
import { isValidDocument, onlyDigits } from './documents';

export const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

/** CPF/CNPJ opcional: vazio vira `null`; preenchido precisa ser válido e é guardado só com dígitos. */
export const documentField = z
  .string()
  .trim()
  .transform((value) => onlyDigits(value))
  .refine((value) => value === '' || isValidDocument(value), 'CPF ou CNPJ inválido')
  .transform((value) => value || null)
  .nullable()
  .optional();

export const phoneField = z
  .string()
  .trim()
  .transform((value) => onlyDigits(value))
  .refine(
    (value) => value === '' || (value.length >= 10 && value.length <= 13),
    'Telefone inválido'
  )
  .transform((value) => value || null)
  .nullable()
  .optional();

export const customerSchema = z.object({
  customer_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  document: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: isoDateTimeSchema,
});
export type Customer = z.infer<typeof customerSchema>;

export const customerRegisterBodySchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(255),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(255),
  password: z.string().min(8, 'A senha precisa de ao menos 8 caracteres').max(128),
  document: documentField,
  phone: phoneField,
});
export type CustomerRegisterBody = z.infer<typeof customerRegisterBodySchema>;

export const customerLoginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
export type CustomerLoginBody = z.infer<typeof customerLoginBodySchema>;

export const customerUpdateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(255),
    document: documentField,
    phone: phoneField,
  })
  .partial();
export type CustomerUpdateBody = z.infer<typeof customerUpdateBodySchema>;

export const customerSessionSchema = z.object({
  access_token: z.string(),
  customer: customerSchema,
});
export type CustomerSession = z.infer<typeof customerSessionSchema>;
export const customerSessionResponseSchema = dataResponse(customerSessionSchema);
export const customerResponseSchema = dataResponse(customerSchema);

// ── Endereços ──────────────────────────────────────────────────────────────────
export const addressSchema = z.object({
  address_id: z.string().uuid(),
  recipient: z.string(),
  zip: z.string(),
  street: z.string(),
  number: z.string(),
  complement: z.string().nullable(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  is_default: z.boolean(),
});
export type Address = z.infer<typeof addressSchema>;

const zipField = z
  .string()
  .trim()
  .transform((value) => onlyDigits(value))
  .refine((value) => value.length === 8, 'CEP com 8 dígitos');

/** Endereço de entrega (também usado no checkout, sem cadastro). */
export const shippingAddressSchema = z.object({
  recipient: z.string().trim().min(2, 'Informe quem recebe').max(255),
  zip: zipField,
  street: z.string().trim().min(2, 'Informe a rua').max(255),
  number: z.string().trim().min(1, 'Informe o número').max(20),
  complement: optionalText(120),
  neighborhood: z.string().trim().min(2, 'Informe o bairro').max(120),
  city: z.string().trim().min(2, 'Informe a cidade').max(120),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(BRAZIL_STATES, { message: 'Escolha o estado' })),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const addressBodySchema = shippingAddressSchema.extend({
  is_default: z.boolean().default(false),
});
export type AddressBody = z.infer<typeof addressBodySchema>;

export const addressUpdateBodySchema = addressBodySchema.partial();
export type AddressUpdateBody = z.infer<typeof addressUpdateBodySchema>;

export const addressParamsSchema = z.object({ address_id: z.string().uuid() });
export const addressListResponseSchema = dataResponse(z.array(addressSchema));
export const addressResponseSchema = dataResponse(addressSchema);
