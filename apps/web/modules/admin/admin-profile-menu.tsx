'use client';

import type { AuthUser } from '@geekstore/shared';
import { Dropdown, Label } from '@heroui/react';
import { ChevronsUpDown, ExternalLink, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { AdminTheme } from './state/ui-store';
import { ROLE_LABELS } from './users/role-labels';

export const ACCOUNT_HREF = '/admin/conta/';

/** Perfil no rodapé do menu: abre as ações da conta (configurações, tema, loja, sair). */
export function AdminProfileMenu({
  collapsed,
  user,
  theme,
  onToggleTheme,
  onLogout,
}: {
  collapsed: boolean;
  user: AuthUser | null;
  theme: AdminTheme;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Tema claro' : 'Tema escuro';

  const handleAction = (key: string | number) => {
    if (key === 'account') router.push(ACCOUNT_HREF);
    if (key === 'store') window.open('/', '_blank', 'noopener');
    if (key === 'theme') onToggleTheme();
    if (key === 'logout') onLogout();
  };

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Menu do perfil"
        className={`flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-night-raised ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-night-raised text-xs font-extrabold text-geek-yellow"
        >
          {user?.name.slice(0, 1).toUpperCase()}
        </span>
        <span
          className={`min-w-0 flex-1 overflow-hidden transition-[max-width,opacity] duration-300 ${
            collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'
          }`}
        >
          <span className="block truncate text-sm font-extrabold text-white">{user?.name}</span>
          <span className="block truncate text-xs text-night-muted">
            {user ? ROLE_LABELS[user.role] : ''}
          </span>
        </span>
        {!collapsed && <ChevronsUpDown size={15} className="shrink-0 text-night-muted" />}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top start" className="min-w-56">
        <div className="border-b border-border px-3 py-2">
          <p className="truncate text-sm font-extrabold">{user?.name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="account" textValue="Configurações da conta">
            <Settings size={16} className="shrink-0 text-muted" />
            <Label>Configurações da conta</Label>
          </Dropdown.Item>
          <Dropdown.Item id="theme" textValue={themeLabel}>
            <ThemeIcon size={16} className="shrink-0 text-muted" />
            <Label>{themeLabel}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="store" textValue="Ver a loja">
            <ExternalLink size={16} className="shrink-0 text-muted" />
            <Label>Ver a loja</Label>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue="Sair" variant="danger">
            <LogOut size={16} className="shrink-0 text-danger" />
            <Label>Sair</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
