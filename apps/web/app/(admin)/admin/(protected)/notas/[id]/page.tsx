import { ReceiptDetail } from '@/modules/admin/receipts/receipt-detail';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Nota de entrada', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="stock:read">
      <ReceiptDetail receiptId={id} />
    </RequirePermission>
  );
}
