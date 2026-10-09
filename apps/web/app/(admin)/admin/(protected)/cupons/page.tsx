import { CouponManager } from '@/modules/admin/coupons/coupon-manager';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Cupons', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <RequirePermission permission="pricing:read">
      <CouponManager />
    </RequirePermission>
  );
}
