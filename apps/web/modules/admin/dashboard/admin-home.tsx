'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { ADMIN_NAV } from '../lib/nav';
import { useAdminAuthStore } from '../state/auth-store';
import { PageHeader } from '../ui/page-header';

export function AdminHome() {
  const user = useAdminAuthStore((state) => state.user);
  const shortcuts = ADMIN_NAV.filter(
    (item) =>
      item.href !== '/admin/' && (!item.permission || user?.permissions.includes(item.permission))
  );

  return (
    <>
      <PageHeader title={`Olá, ${user?.name.split(' ')[0] ?? 'bem-vindo'}`} />
      <p className="muted mb-6 text-sm">O que você quer fazer agora?</p>
      <div className="grid grid-cols-3 gap-4 max-tablet:grid-cols-2 max-md:grid-cols-1">
        {shortcuts.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="surface group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-geek-yellow text-ink">
              <Icon size={20} />
            </span>
            <strong className="text-lg">{label}</strong>
            <span className="muted text-sm">{description}</span>
            <span className="mt-auto flex items-center gap-1.5 text-sm font-extrabold">
              Abrir{' '}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
