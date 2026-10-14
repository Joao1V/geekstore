'use client';

import { MapPin, Package, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { useCustomerStore } from '../state/customer-store';

const LINKS = [
  { href: '/conta/', label: 'Meus dados', icon: UserRound, exact: true },
  { href: '/conta/pedidos/', label: 'Meus pedidos', icon: Package, exact: false },
  { href: '/conta/enderecos/', label: 'Endereços', icon: MapPin, exact: false },
  { href: '/conta/privacidade/', label: 'Privacidade', icon: ShieldCheck, exact: false },
] as const;

/** Moldura da área da conta: manda quem não entrou para o login e mostra o menu lateral. */
export function AccountShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const status = useCustomerStore((state) => state.status);
  const customer = useCustomerStore((state) => state.customer);

  useEffect(() => {
    if (status === 'guest') router.replace(`/entrar/?next=${encodeURIComponent(path)}`);
  }, [status, path, router]);

  if (status !== 'authenticated' || !customer) {
    return <p className="wrap section muted">Verificando sua sessão…</p>;
  }
  return (
    <section className="wrap section">
      <p className="eyebrow orange">Minha conta</p>
      <h1 className="section-title">Olá, {customer.name.split(' ')[0]}!</h1>
      <div className="mt-6 grid grid-cols-[230px_1fr] items-start gap-8 max-md:grid-cols-1">
        <nav aria-label="Minha conta" className="surface grid gap-1 p-2.5 max-md:grid-cols-2">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-extrabold max-md:justify-center max-md:px-2 max-md:text-xs ${active ? 'bg-geek-yellow text-ink' : 'hover:bg-surface-secondary'}`}
              >
                <Icon size={17} aria-hidden="true" /> {label}
              </Link>
            );
          })}
        </nav>
        <div>{children}</div>
      </div>
    </section>
  );
}
