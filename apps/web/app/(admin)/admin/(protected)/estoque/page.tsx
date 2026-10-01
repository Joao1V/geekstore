import { Suspense } from 'react';

import { StockGrid } from '@/modules/admin/stock/stock-grid';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Estoque e preços', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="stock:read">
      <Suspense>
        <StockGrid />
      </Suspense>
    </RequirePermission>
  );
}
