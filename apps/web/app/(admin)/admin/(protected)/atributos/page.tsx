import { AttributeManager } from '@/modules/admin/attributes/attribute-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Atributos', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <AttributeManager />
    </RequirePermission>
  );
}
