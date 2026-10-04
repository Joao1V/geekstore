import { type RoleCode, roleCodeSchema } from '@geekstore/shared';
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
  // O token de um cliente da loja é assinado com a mesma chave, mas não tem perfil: não entra no admin.
  if (!roleCodeSchema.safeParse(request.user.role).success) {
    throw new UnauthorizedError('Token de acesso ausente, inválido ou expirado.');
  }
}
