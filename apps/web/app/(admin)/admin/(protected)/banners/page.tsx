import { BannerManager } from '@/modules/admin/content/banner-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Banners', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="content:read">
      <BannerManager />
    </RequirePermission>
  );
}
