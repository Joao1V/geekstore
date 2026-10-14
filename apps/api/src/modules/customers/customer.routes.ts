import {
  addressBodySchema,
  addressListResponseSchema,
  addressParamsSchema,
  addressResponseSchema,
  addressUpdateBodySchema,
  customerLoginBodySchema,
  customerRegisterBodySchema,
  customerResponseSchema,
  customerSessionResponseSchema,
  customerUpdateBodySchema,
  dataResponse,
  forgotPasswordBodySchema,
  googleLoginBodySchema,
  resetPasswordBodySchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  createAddressController,
  deleteAddressController,
  forgotPasswordController,
  googleLoginController,
  listAddressesController,
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
  resetPasswordController,
  updateAddressController,
  updateMeController,
} from './customer.controller';

const tags = ['Cliente'];
const okResponseSchema = dataResponse(z.object({ ok: z.literal(true) }));
const AUTH_RATE_LIMIT = { max: 8, timeWindow: '1 minute' };

/** Conta do cliente da loja (cadastro, login, perfil, endereços). Prefixo: /api/customer. */
export async function customerRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/auth/register',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags,
        summary: 'Cria a conta e já entra',
        body: customerRegisterBodySchema,
        response: { 201: customerSessionResponseSchema },
      },
    },
    registerController
  );
  app.post(
    '/auth/forgot-password',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags,
        summary: 'Pede o e-mail de nova senha (a resposta não revela se a conta existe)',
        body: forgotPasswordBodySchema,
        response: { 200: okResponseSchema },
      },
    },
    forgotPasswordController
  );
  app.post(
    '/auth/reset-password',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags,
        summary: 'Define a nova senha com o link do e-mail e encerra as outras sessões',
        body: resetPasswordBodySchema,
        response: { 200: okResponseSchema },
      },
    },
    resetPasswordController
  );
  app.post(
    '/auth/login',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags,
        summary: 'Entra com e-mail e senha',
        body: customerLoginBodySchema,
        response: { 200: customerSessionResponseSchema },
      },
    },
    loginController
  );
  app.post(
    '/auth/google',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        tags,
        summary: 'Entra (ou cria a conta) com o ID token do Google',
        body: googleLoginBodySchema,
        response: { 200: customerSessionResponseSchema },
      },
    },
    googleLoginController
  );
  app.post(
    '/auth/refresh',
    {
      schema: {
        tags,
        summary: 'Renova a sessão pelo cookie',
        response: { 200: customerSessionResponseSchema },
      },
    },
    refreshController
  );
  app.post('/auth/logout', { schema: { tags, summary: 'Sai da conta' } }, logoutController);

  app.get(
    '/me',
    { schema: { tags, summary: 'Meus dados', response: { 200: customerResponseSchema } } },
    meController
  );
  app.patch(
    '/me',
    {
      schema: {
        tags,
        summary: 'Atualiza nome, CPF/CNPJ e telefone',
        body: customerUpdateBodySchema,
        response: { 200: customerResponseSchema },
      },
    },
    updateMeController
  );

  app.get(
    '/addresses',
    { schema: { tags, summary: 'Meus endereços', response: { 200: addressListResponseSchema } } },
    listAddressesController
  );
  app.post(
    '/addresses',
    {
      schema: {
        tags,
        summary: 'Adiciona um endereço',
        body: addressBodySchema,
        response: { 201: addressResponseSchema },
      },
    },
    createAddressController
  );
  app.patch(
    '/addresses/:address_id',
    {
      schema: {
        tags,
        summary: 'Edita um endereço (ou o torna o padrão)',
        params: addressParamsSchema,
        body: addressUpdateBodySchema,
        response: { 200: addressResponseSchema },
      },
    },
    updateAddressController
  );
  app.delete(
    '/addresses/:address_id',
    { schema: { tags, summary: 'Apaga um endereço', params: addressParamsSchema } },
    deleteAddressController
  );
}
