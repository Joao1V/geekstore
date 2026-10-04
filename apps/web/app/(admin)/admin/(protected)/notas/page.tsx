import { Suspense } from 'react';

import { ReceiptList } from '@/modules/admin/receipts/receipt-list';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Notas de entrada', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="stock:read">
      <Suspense>
        <ReceiptList />
      </Suspense>
    </RequirePermission>
  );
}
