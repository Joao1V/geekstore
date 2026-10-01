import type { AdminUserBody, AdminUserUpdateBody, PaginationQuery } from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { createUser, deleteUser, getUser, listUsers, updateUser } from './users.service';

type UserParams = { user_id: string };

export function listUsersController(request: FastifyRequest<{ Querystring: PaginationQuery }>) {
  return listUsers(request.query);
}

export async function getUserController(request: FastifyRequest<{ Params: UserParams }>) {
  return { data: await getUser(request.params.user_id) };
}

export async function createUserController(
  request: FastifyRequest<{ Body: AdminUserBody }>,
  reply: FastifyReply
) {
  const data = await createUser(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateUserController(
  request: FastifyRequest<{ Params: UserParams; Body: AdminUserUpdateBody }>
) {
  return { data: await updateUser(request.user.sub, request.params.user_id, request.body) };
}

export async function deleteUserController(
  request: FastifyRequest<{ Params: UserParams }>,
  reply: FastifyReply
) {
  await deleteUser(request.user.sub, request.params.user_id);
  return reply.status(204).send();
}
