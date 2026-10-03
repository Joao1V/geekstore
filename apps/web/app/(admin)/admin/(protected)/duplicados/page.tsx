import { DuplicateCenter } from '@/modules/admin/duplicates/duplicate-center';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Duplicados', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="catalog:read">
      <DuplicateCenter />
    </RequirePermission>
  );
}
