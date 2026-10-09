import { PageManager } from '@/modules/admin/content/page-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Páginas', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="content:read">
      <PageManager />
    </RequirePermission>
  );
}
