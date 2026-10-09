import { NewPageScreen } from '@/modules/admin/content/page-editor';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Nova página', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="content:write">
      <NewPageScreen />
    </RequirePermission>
  );
}
