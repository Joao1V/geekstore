import { Suspense } from 'react';

import { OutboxList } from '@/modules/admin/outbox/outbox-list';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Eventos', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="queues:read">
      <Suspense>
        <OutboxList />
      </Suspense>
    </RequirePermission>
  );
}
