'use client';

import { Button } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';

import { useAdminAuthStore } from '../state/auth-store';
import { useAdminUiStore } from '../state/ui-store';
import { PageHeader } from '../ui/page-header';
import { ROLE_LABELS } from '../users/role-labels';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-border py-3 text-sm last:border-0 max-md:grid-cols-1 max-md:gap-1">
      <dt className="font-extrabold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function AccountPage() {
  const user = useAdminAuthStore((state) => state.user);
  const theme = useAdminUiStore((state) => state.theme);
  const toggleTheme = useAdminUiStore((state) => state.toggleTheme);
  if (!user) return null;
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <>
      <PageHeader title="Configurações da conta" eyebrow="Minha conta" />
      <section className="max-w-2xl rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 text-lg font-extrabold">Perfil</h2>
        <dl>
          <Row label="Nome">{user.name}</Row>
          <Row label="E-mail">{user.email}</Row>
          <Row label="Perfil de acesso">{ROLE_LABELS[user.role]}</Row>
          <Row label="Permissões">
            <span className="flex flex-wrap gap-1.5">
              {user.permissions.map((permission) => (
                <code
                  key={permission}
                  className="rounded bg-surface-secondary px-1.5 py-0.5 text-xs"
                >
                  {permission}
                </code>
              ))}
            </span>
          </Row>
        </dl>
      </section>
      <section className="mt-5 max-w-2xl rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-lg font-extrabold">Aparência</h2>
        <Button variant="outline" className="font-extrabold" onPress={toggleTheme}>
          <ThemeIcon size={16} /> {theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        </Button>
      </section>
    </>
  );
}
