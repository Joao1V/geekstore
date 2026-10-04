import { Suspense } from 'react';

import { OrderList } from '@/modules/admin/orders/order-list';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Pedidos', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="orders:read">
      <Suspense>
        <OrderList />
      </Suspense>
    </RequirePermission>
  );
}
