'use client';

import type { Permission } from '@geekstore/shared';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { useCan } from '../lib/use-can';

/** Só UX: esconde a tela sem permissão. A autoridade continua sendo a API. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const allowed = useCan(permission);
  if (allowed) return <>{children}</>;
  return (
    <div className="surface empty" role="alert">
      <Lock size={42} />
      <h3>Sem acesso</h3>
      <p>Seu perfil não tem permissão para ver esta área. Fale com quem administra o painel.</p>
    </div>
  );
}
