import { notFound } from 'next/navigation';

import { AccountOrderDetail } from '@/modules/store/account/account-order-detail';

export const metadata = { title: 'Pedido' };

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const number = Number((await params).number);
  if (!Number.isInteger(number) || number < 1) notFound();
  return <AccountOrderDetail number={number} />;
}
