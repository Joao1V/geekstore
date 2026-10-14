'use client';

import type { AuthUser } from '@geekstore/shared';
import { Tooltip } from '@heroui/react';
import { ChevronDown, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import Link from 'next/link';

import { AdminProfileMenu } from './admin-profile-menu';
import { ADMIN_NAV_GROUPS } from './lib/nav';
import type { AdminTheme } from './state/ui-store';

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

/** Com o menu recolhido só sobram ícones: o tooltip diz o nome e o que a tela faz. */
function NavTip({
  enabled,
  title,
  description,
  children,
}: {
  enabled: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  if (!enabled) return children;
  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger aria-label={title} className="max-md:contents">
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content placement="right" offset={12} className="w-max max-w-60 max-md:hidden">
        <p className="text-sm font-extrabold">{title}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </Tooltip.Content>
    </Tooltip>
  );
}

export function AdminSidebar({
  collapsed,
  onToggleCollapsed,
  collapsedGroups,
  onToggleGroup,
  theme,
  onToggleTheme,
  user,
  pathname,
  onLogout,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsedGroups: string[];
  onToggleGroup: (label: string) => void;
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
        {groups.map((group) => {
          const label = group.label;
          // Recolhido (só ícones) mostra tudo: o acordeão só vale com o menu aberto.
          const isOpen = !label || collapsed || !collapsedGroups.includes(label);
          const hasActive = group.items.some((item) => isActive(item.href));
          return (
            <div key={label ?? 'top'} className="flex flex-col gap-1 max-md:contents">
              {label && !collapsed && (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="flex items-center justify-between rounded-lg px-3 pt-2.5 pb-1 text-2xs font-extrabold tracking-widest whitespace-nowrap text-night-muted uppercase hover:text-night-fg max-md:hidden"
                  onClick={() => onToggleGroup(label)}
                >
                  <span className="flex items-center gap-2">
                    {label}
                    {!isOpen && hasActive && (
                      <span aria-hidden className="size-1.5 rounded-full bg-geek-yellow" />
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                  />
                </button>
              )}
              {label && collapsed && (
                <div aria-hidden className="mx-2 my-2 h-px bg-night-dim max-md:hidden" />
              )}
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out max-md:contents ${
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div
                  className={`flex min-h-0 flex-col gap-1 overflow-hidden max-md:contents ${
                    label && !collapsed
                      ? 'ml-4 border-l border-night-dim pl-2 max-md:ml-0 max-md:border-0 max-md:pl-0'
                      : ''
                  }`}
                >
                  {group.items.map(({ href, label: itemLabel, description, icon: Icon }) => (
                    <NavTip
                      key={href}
                      enabled={collapsed}
                      title={itemLabel}
                      description={description}
                    >
                      <Link
                        href={href}
                        aria-label={collapsed ? itemLabel : undefined}
                        aria-current={isActive(href) ? 'page' : undefined}
                        tabIndex={isOpen ? undefined : -1}
                        className={`${ROW} ${collapsed ? 'md:justify-center' : ''} ${isActive(href) ? 'bg-geek-yellow text-ink' : idle}`}
                      >
                        <Icon size={17} className="shrink-0" />
                        <Label collapsed={collapsed}>{itemLabel}</Label>
                      </Link>
                    </NavTip>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-night-dim pt-2 max-md:hidden">
        <AdminProfileMenu
          collapsed={collapsed}
          user={user}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}
