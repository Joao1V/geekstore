import { Suspense } from 'react';

import { RequirePermission } from '@/modules/admin/ui/require-permission';
import { UserManager } from '@/modules/admin/users/user-manager';

export const metadata = { title: 'Usuários', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="users:read">
      <Suspense>
        <UserManager />
      </Suspense>
    </RequirePermission>
  );
}
