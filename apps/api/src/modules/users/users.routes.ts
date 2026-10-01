import {
  adminUserBodySchema,
  adminUserListQuerySchema,
  adminUserListResponseSchema,
  adminUserParamsSchema,
  adminUserResponseSchema,
  adminUserUpdateBodySchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  createUserController,
  deleteUserController,
  getUserController,
  listUsersController,
  updateUserController,
} from './users.controller';

const tags = ['Usuários'];
const read = { onRequest: requirePermission('users:read') };
const write = { onRequest: requirePermission('users:write') };

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista usuários do admin',
        querystring: adminUserListQuerySchema,
        response: { 200: adminUserListResponseSchema },
      },
    },
    listUsersController
  );
  app.get(
    '/:user_id',
    {
      ...read,
      schema: {
        tags,
        summary: 'Detalhe do usuário',
        params: adminUserParamsSchema,
        response: { 200: adminUserResponseSchema },
      },
    },
    getUserController
  );
  app.post(
    '/',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria usuário do admin',
        body: adminUserBodySchema,
        response: { 201: adminUserResponseSchema },
      },
    },
    createUserController
  );
  app.patch(
    '/:user_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Edita nome, senha ou perfil (não o próprio perfil; nunca o último owner)',
        params: adminUserParamsSchema,
        body: adminUserUpdateBodySchema,
        response: { 200: adminUserResponseSchema },
      },
    },
    updateUserController
  );
  app.delete(
    '/:user_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Exclui usuário (não a própria conta; nunca o último owner)',
        params: adminUserParamsSchema,
      },
    },
    deleteUserController
  );
}
