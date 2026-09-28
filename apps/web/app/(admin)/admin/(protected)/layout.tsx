'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AdminGuard } from '@/modules/admin/admin-guard';
import { logout } from '@/modules/admin/lib/auth-client';
import { useAdminAuthStore } from '@/modules/admin/state/auth-store';

function AdminTopbar() {
  const router = useRouter();
  const user = useAdminAuthStore((state) => state.user);
  const clearSession = useAdminAuthStore((state) => state.clearSession);

  const handleLogout = async () => {
    await logout();
    clearSession();
    router.replace('/admin/entrar/');
  };

  return (
    <div className="admin-topbar wrap">
      <span>{user?.name}</span>
      <button type="button" onClick={handleLogout}>
        <LogOut size={16} /> Sair
      </button>
    </div>
  );
}

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminTopbar />
      {children}
    </AdminGuard>
  );
}
