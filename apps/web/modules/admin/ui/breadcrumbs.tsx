'use client';

import { Breadcrumbs as HeroBreadcrumbs } from '@heroui/react';
import { Home } from 'lucide-react';

export type Crumb = { label: string; href?: string };

const HOME: Crumb = { label: 'Início', href: '/admin/' };

/** Caminho de navegação: sempre começa em "Início"; o último item é a página atual (sem link). */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const items = [HOME, ...crumbs];
  return (
    <HeroBreadcrumbs className="mb-2 text-xs">
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1;
        return (
          <HeroBreadcrumbs.Item
            key={crumb.label}
            href={isLast ? undefined : crumb.href}
            className="max-w-[28ch] truncate font-bold"
          >
            {index === 0 && <Home size={12} aria-hidden className="mr-1 inline" />}
            {crumb.label}
          </HeroBreadcrumbs.Item>
        );
      })}
    </HeroBreadcrumbs>
  );
}
