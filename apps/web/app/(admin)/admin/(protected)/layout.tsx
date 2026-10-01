import { AdminGuard } from '@/modules/admin/admin-guard';
import { AdminShell } from '@/modules/admin/admin-shell';

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
