import type { ReactNode } from 'react';

import { Breadcrumbs, type Crumb } from './breadcrumbs';

export function PageHeader({
  title,
  eyebrow = 'GeekStore Studio',
  actions,
  crumbs,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  /** Caminho até esta tela, sem o "Início" (ele entra sozinho). Sem isto, não mostra o breadcrumb. */
  crumbs?: Crumb[];
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {crumbs && <Breadcrumbs crumbs={crumbs} />}
        <p className="eyebrow orange">{eyebrow}</p>
        <h1 className="section-title mb-0">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
