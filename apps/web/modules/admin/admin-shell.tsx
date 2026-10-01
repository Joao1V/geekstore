'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ADMIN_NAV } from './lib/nav';
import { useLogout } from './services/auth/mutations';
import { useAdminAuthStore } from './state/auth-store';
import { ROLE_LABELS } from './users/role-labels';

const NAV_LINK =
  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-extrabold whitespace-nowrap max-md:px-2.5';

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAdminAuthStore((state) => state.user);
  const clearSession = useAdminAuthStore((state) => state.clearSession);
  const logout = useLogout();

  const items = ADMIN_NAV.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission)
  );

  const isActive = (href: string) =>
    href === '/admin/' ? pathname === href : pathname.startsWith(href);

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
    <div className="grid min-h-screen grid-cols-[248px_1fr] max-md:grid-cols-1">
      <aside className="flex flex-col gap-6 bg-night p-4 text-night-fg max-md:gap-3 max-md:p-3 md:sticky md:top-0 md:h-screen">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl tracking-[0.04em] text-geek-yellow">GeekStore</p>
            <p className="text-2xs tracking-widest text-night-muted uppercase">Studio</p>
          </div>
          <button
            type="button"
            aria-label="Sair"
            className="flex items-center gap-2 rounded-lg border border-night-dim px-3 py-2 text-xs font-extrabold md:hidden"
            onClick={handleLogout}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
        <nav
          aria-label="Painel"
          className="flex flex-col gap-1 max-md:-mx-1 max-md:flex-row max-md:overflow-x-auto"
        >
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`${NAV_LINK} ${isActive(href) ? 'bg-geek-yellow text-ink' : 'hover:bg-night-raised'}`}
            >
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-night-dim pt-4 max-md:hidden">
          <div>
            <p className="text-sm font-extrabold text-white">{user?.name}</p>
            <p className="text-xs text-night-muted">{user ? ROLE_LABELS[user.role] : ''}</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-night-dim px-3 py-2 text-sm font-extrabold"
            onClick={handleLogout}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-8 py-8 max-tablet:px-5 max-md:px-4 max-md:py-5">{children}</main>
    </div>
  );
}
