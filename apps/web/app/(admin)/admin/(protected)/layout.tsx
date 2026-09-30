'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AdminGuard } from '@/modules/admin/admin-guard';
import { useLogout } from '@/modules/admin/services/auth/mutations';
import { useAdminAuthStore } from '@/modules/admin/state/auth-store';

function AdminTopbar() {
  const router = useRouter();
  const user = useAdminAuthStore((state) => state.user);
  const clearSession = useAdminAuthStore((state) => state.clearSession);
  const logout = useLogout();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // A revogação no servidor é best-effort: a sessão local termina de qualquer forma.
    } finally {
      clearSession();
      router.replace('/admin/entrar/');
    }
  };

  return (
    <div className="wrap mb-2.5 flex items-center justify-between border-b border-border py-[18px]">
      <span>{user?.name}</span>
      <button
        type="button"
        className="flex items-center gap-2 rounded-[9px] border border-border bg-surface px-3.5 py-[9px] text-sm font-extrabold text-foreground"
        onClick={handleLogout}
      >
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
