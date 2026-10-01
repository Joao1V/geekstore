import type { ReactNode } from 'react';

export function PageHeader({
  title,
  eyebrow = 'GeekStore Studio',
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow orange">{eyebrow}</p>
        <h1 className="section-title mb-0">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
