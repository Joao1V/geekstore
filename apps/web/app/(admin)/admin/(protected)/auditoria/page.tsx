import { Suspense } from 'react';

import { AuditList } from '@/modules/admin/audit/audit-list';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Auditoria', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="audit:read">
      <Suspense>
        <AuditList />
      </Suspense>
    </RequirePermission>
  );
}
