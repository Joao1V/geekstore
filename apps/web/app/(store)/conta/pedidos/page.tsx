import { Suspense } from 'react';

import { AccountOrders } from '@/modules/store/account/account-orders';

export const metadata = { title: 'Meus pedidos' };

export default function Page() {
  return (
    <Suspense>
      <AccountOrders />
    </Suspense>
  );
}
