import { Suspense } from 'react';

import { ProductList } from '@/modules/admin/products/product-list';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Produtos', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <Suspense>
        <ProductList />
      </Suspense>
    </RequirePermission>
  );
}
