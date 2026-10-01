import { ProductForm } from '@/modules/admin/products/product-form';
import { PageHeader } from '@/modules/admin/ui/page-header';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Novo produto', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:write">
      <PageHeader title="Novo produto" eyebrow="Catálogo" />
      <ProductForm />
    </RequirePermission>
  );
}
