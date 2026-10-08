'use client';

import type { AuthUser } from '@geekstore/shared';
import { LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import Link from 'next/link';

import { ADMIN_NAV_GROUPS } from './lib/nav';
import type { AdminTheme } from './state/ui-store';
import { ROLE_LABELS } from './users/role-labels';

const ROW =
  'flex items-center rounded-lg px-3 py-2 text-sm font-extrabold whitespace-nowrap max-md:px-2.5';

/** Texto que some (largura e opacidade) quando o menu recolhe; no celular nunca some. */
function Label({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`overflow-hidden transition-[max-width,opacity,margin] duration-300 ease-out max-md:ml-2.5 max-md:max-w-none max-md:opacity-100 ${
        collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-44 opacity-100'
      }`}
    >
      {children}
    </span>
  );
}

export function AdminSidebar({
  collapsed,
  onToggleCollapsed,
  theme,
  onToggleTheme,
  user,
  pathname,
  onLogout,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  theme: AdminTheme;
  onToggleTheme: () => void;
  user: AuthUser | null;
  pathname: string;
  onLogout: () => void;
}) {
  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || user?.permissions.includes(item.permission)
    ),
  })).filter((group) => group.items.length > 0);

  const isActive = (href: string) =>
    href === '/admin/' ? pathname === href : pathname.startsWith(href);

  const nextThemeLabel = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const idle = 'hover:bg-night-raised';

  return (
    <aside className="flex flex-col gap-3 overflow-hidden bg-night p-3 text-night-fg max-md:gap-3 md:sticky md:top-0 md:h-screen">
      <div
        className={`flex items-center justify-between gap-2 px-1 pt-1 ${collapsed ? 'md:flex-col md:justify-center' : ''}`}
      >
        <div className="min-w-0">
          <p className="font-display text-2xl tracking-[0.04em] whitespace-nowrap text-geek-yellow">
            {collapsed ? <span className="max-md:hidden">G</span> : null}
            <span className={collapsed ? 'md:hidden' : ''}>GeekStore</span>
          </p>
          <p
            className={`text-2xs tracking-widest text-night-muted uppercase ${collapsed ? 'md:hidden' : ''}`}
          >
            Studio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={nextThemeLabel}
            title={nextThemeLabel}
            className="grid size-9 place-items-center rounded-lg border border-night-dim hover:bg-night-raised md:hidden"
            onClick={onToggleTheme}
          >
            <ThemeIcon size={16} />
          </button>
          <button
            type="button"
            aria-label="Sair"
            className="flex items-center gap-2 rounded-lg border border-night-dim px-3 py-2 text-xs font-extrabold md:hidden"
            onClick={onLogout}
          >
            <LogOut size={14} /> Sair
          </button>
          <button
            type="button"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-night-muted hover:bg-night-raised hover:text-night-fg max-md:hidden"
            onClick={onToggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </div>

      <nav
        aria-label="Painel"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto max-md:-mx-1 max-md:flex-none max-md:flex-row max-md:overflow-x-auto max-md:overflow-y-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {groups.map((group) => (
          <div key={group.label ?? 'top'} className="flex flex-col gap-1 max-md:contents">
            {group.label && (
              <>
                <p
                  className={`px-3 pt-2.5 pb-0.5 text-2xs font-extrabold tracking-widest whitespace-nowrap text-night-muted uppercase transition-opacity duration-300 max-md:hidden ${
                    collapsed ? 'hidden' : ''
                  }`}
                >
                  {group.label}
                </p>
                {collapsed && (
                  <div aria-hidden className="mx-2 my-2 h-px bg-night-dim max-md:hidden" />
                )}
              </>
            )}
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-label={collapsed ? label : undefined}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`${ROW} ${collapsed ? 'md:justify-center' : ''} ${isActive(href) ? 'bg-geek-yellow text-ink' : idle}`}
              >
                <Icon size={17} className="shrink-0" />
                <Label collapsed={collapsed}>{label}</Label>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="grid gap-1 border-t border-night-dim pt-2 max-md:hidden">
        <button
          type="button"
          title={collapsed ? nextThemeLabel : undefined}
          aria-label={nextThemeLabel}
          className={`${ROW} ${collapsed ? 'justify-center' : ''} ${idle}`}
          onClick={onToggleTheme}
        >
          <ThemeIcon size={17} className="shrink-0" />
          <Label collapsed={collapsed}>{nextThemeLabel}</Label>
        </button>
        <div
          className={`flex items-center gap-2.5 py-0.5 ${collapsed ? 'justify-center' : 'px-3'}`}
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-night-raised text-xs font-extrabold text-geek-yellow"
          >
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          <div
            className={`min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ${
              collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'
            }`}
          >
            <p className="truncate text-sm font-extrabold text-white">{user?.name}</p>
            <p className="truncate text-xs text-night-muted">
              {user ? ROLE_LABELS[user.role] : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          title={collapsed ? 'Sair' : undefined}
          aria-label="Sair"
          className={`${ROW} border border-night-dim ${collapsed ? 'justify-center' : ''} ${idle}`}
          onClick={onLogout}
        >
          <LogOut size={16} className="shrink-0" />
          <Label collapsed={collapsed}>Sair</Label>
        </button>
      </div>
    </aside>
  );
}
