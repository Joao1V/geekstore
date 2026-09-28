import { authLoginBodySchema, authSessionResponseSchema } from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { loginController, logoutController, refreshController } from './auth.controller';

const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' };

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/login',
    {
      config: { rateLimit: LOGIN_RATE_LIMIT },
      schema: { body: authLoginBodySchema, response: { 200: authSessionResponseSchema } },
    },
    loginController
  );

  fastify
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/refresh',
      { schema: { response: { 200: authSessionResponseSchema } } },
      refreshController
    );

  fastify.post('/logout', logoutController);
}
