import { BrandManager } from '@/modules/admin/brands/brand-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Marcas', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <BrandManager />
    </RequirePermission>
  );
}
