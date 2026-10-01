import type { Permission } from '@geekstore/shared';

import { authenticate } from './authenticate';
import { authorize } from './authorize';

export * from './authenticate';
export * from './authorize';

/** `onRequest` padrão das rotas do admin: autentica e checa a permissão. */
export function requirePermission(permission: Permission) {
  return [authenticate, authorize(permission)];
}
