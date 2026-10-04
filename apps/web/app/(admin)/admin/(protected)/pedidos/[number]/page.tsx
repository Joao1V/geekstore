import { notFound } from 'next/navigation';

import { OrderDetail } from '@/modules/admin/orders/order-detail';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Pedido', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const number = Number((await params).number);
  if (!Number.isInteger(number) || number < 1) notFound();
  return (
    <RequirePermission permission="orders:read">
      <OrderDetail number={number} />
    </RequirePermission>
  );
}
