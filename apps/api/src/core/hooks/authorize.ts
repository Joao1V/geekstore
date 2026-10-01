import { hasPermission, type Permission } from '@geekstore/shared';
import type { FastifyRequest } from 'fastify';

import { ForbiddenError } from '../_errors';

/** Hook `onRequest` (depois de `authenticate`): exige que o perfil do token tenha a permissão. */
export function authorize(permission: Permission) {
  return async function authorizeHook(request: FastifyRequest): Promise<void> {
    if (!hasPermission(request.user.role, permission)) {
      throw new ForbiddenError('Seu perfil não tem permissão para esta ação.');
    }
  };
}
