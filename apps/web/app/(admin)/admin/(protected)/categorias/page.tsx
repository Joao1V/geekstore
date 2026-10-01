import { CategoryManager } from '@/modules/admin/categories/category-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Categorias', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <CategoryManager />
    </RequirePermission>
  );
}
