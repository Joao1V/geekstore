'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, PackageCheck, Tags, Wallet } from 'lucide-react';
import Link from 'next/link';

import { getErrorMessage } from '../lib/errors';
import { formatBRLCompact, formatInteger } from '../lib/format';
import { ADMIN_NAV } from '../lib/nav';
import { catalogDashboardQueryOptions } from '../services/catalog/queries';
import { useAdminAuthStore } from '../state/auth-store';
import { PageHeader } from '../ui/page-header';
import { CatalogHealth } from './catalog-health';
import { CategoryBars } from './category-bars';
import { KpiCard } from './kpi-card';

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 motion-safe:animate-pulse" aria-hidden="true">
      <div className="grid grid-cols-4 gap-4 max-tablet:grid-cols-2 max-md:grid-cols-1">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="surface h-28" />
        ))}
      </div>
      <div className="surface h-80" />
    </div>
  );
}

export function AdminHome() {
  const user = useAdminAuthStore((state) => state.user);
  const canReadCatalog = Boolean(user?.permissions.includes('catalog:read'));
  const { data, isPending, error } = useQuery({
    ...catalogDashboardQueryOptions(),
    enabled: canReadCatalog,
  });
  const shortcuts = ADMIN_NAV.filter(
    (item) =>
      item.href !== '/admin/' && (!item.permission || user?.permissions.includes(item.permission))
  );

  return (
    <>
      <PageHeader title={`Olá, ${user?.name.split(' ')[0] ?? 'bem-vindo'}`} />
      {canReadCatalog && isPending && <DashboardSkeleton />}
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      {data && (
        <div className="mb-8 grid gap-4">
          <div className="grid grid-cols-4 gap-4 max-tablet:grid-cols-2 max-md:grid-cols-1">
            <KpiCard
              icon={PackageCheck}
              label="Produtos ativos"
              value={formatInteger(data.products.active)}
              hint={`de ${formatInteger(data.products.total)} · ${formatInteger(data.products.draft)} em rascunho`}
            />
            <KpiCard
              icon={Tags}
              label="SKUs"
              value={formatInteger(data.skus.total)}
              hint={`${formatInteger(data.skus.active)} ativos`}
            />
            <KpiCard
              icon={Boxes}
              label="Unidades em estoque"
              value={formatInteger(data.stock.units)}
              hint={`${formatInteger(data.health.out_of_stock)} produtos esgotados`}
            />
            <KpiCard
              icon={Wallet}
              label="Valor do estoque"
              value={formatBRLCompact(data.stock.value_cents)}
              hint="a preço de vitrine"
            />
          </div>
          <div className="grid grid-cols-[2fr_1fr] items-start gap-4 max-tablet:grid-cols-1">
            <CatalogHealth data={data} />
            <CategoryBars categories={data.by_category} />
          </div>
        </div>
      )}
      <h2 className="mb-3 text-xl font-extrabold">Atalhos</h2>
      <div className="grid grid-cols-4 gap-3 max-tablet:grid-cols-2 max-md:grid-cols-1">
        {shortcuts.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="surface group flex items-start gap-3 p-4 transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="flex items-center gap-1.5">
                {label}
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </strong>
              <span className="muted block text-xs">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
