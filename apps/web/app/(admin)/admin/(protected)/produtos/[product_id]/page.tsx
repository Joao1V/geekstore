import { ProductDetailScreen } from '@/modules/admin/products/product-detail-screen';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Editar produto', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ product_id: string }> }) {
  const { product_id } = await params;
  return (
    <RequirePermission permission="catalog:read">
      <ProductDetailScreen productId={product_id} />
    </RequirePermission>
  );
}
