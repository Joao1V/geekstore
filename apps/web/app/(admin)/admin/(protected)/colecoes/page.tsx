import { CollectionManager } from '@/modules/admin/collections/collection-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Coleções', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <CollectionManager />
    </RequirePermission>
  );
}
