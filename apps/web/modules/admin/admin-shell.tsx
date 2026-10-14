'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { AdminSidebar } from './admin-sidebar';
import { useLogout } from './services/auth/mutations';
import { useAdminAuthStore } from './state/auth-store';
import { useAdminUiStore } from './state/ui-store';

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAdminAuthStore((state) => state.user);
  const clearSession = useAdminAuthStore((state) => state.clearSession);
  const theme = useAdminUiStore((state) => state.theme);
  const collapsed = useAdminUiStore((state) => state.sidebarCollapsed);
  const toggleTheme = useAdminUiStore((state) => state.toggleTheme);
  const toggleSidebar = useAdminUiStore((state) => state.toggleSidebar);
  const collapsedGroups = useAdminUiStore((state) => state.collapsedGroups);
  const toggleGroup = useAdminUiStore((state) => state.toggleGroup);
  const logout = useLogout();
  // A animação só liga depois de ler o estado salvo: sem isso, quem deixou o menu recolhido veria
  // ele "fechar" a cada recarga da página.
  const [animated, setAnimated] = useState(false);

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

  useEffect(() => {
    useAdminUiStore.persist.rehydrate();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setAnimated(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div
      className={`grid min-h-screen max-md:grid-cols-1 ${
        collapsed ? 'md:grid-cols-[72px_1fr]' : 'md:grid-cols-[248px_1fr]'
      } ${animated ? 'transition-[grid-template-columns] duration-300 ease-out' : ''}`}
    >
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleSidebar}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        pathname={pathname}
        onLogout={handleLogout}
      />
      <main className="min-w-0 px-8 py-8 max-tablet:px-5 max-md:px-4 max-md:py-5">{children}</main>
    </div>
  );
}
