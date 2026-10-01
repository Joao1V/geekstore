import type { RoleCode } from '@geekstore/shared';
import type { FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../_errors';

/** Conteúdo do JWT de acesso: `sub` é o `user_id`; o perfil vai junto para evitar ida ao banco. */
export type AccessTokenPayload = { sub: string; role: RoleCode };

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

/** Hook `onRequest`: exige `Authorization: Bearer <access token>` válido; preenche `request.user`. */
export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Token de acesso ausente, inválido ou expirado.');
  }
}
