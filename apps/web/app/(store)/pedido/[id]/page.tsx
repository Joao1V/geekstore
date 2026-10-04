import { OrderConfirmation } from '@/modules/store/order-confirmation';

export const metadata = { title: 'Seu pedido', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderConfirmation orderId={id} />;
}
