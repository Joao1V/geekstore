import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

export type Crumb = { label: string; href?: string };

const HOME: Crumb = { label: 'Início', href: '/admin/' };

/** Caminho de navegação: sempre começa em "Início"; o último item é a página atual (sem link). */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const items = [HOME, ...crumbs];
  return (
    <nav aria-label="Caminho" className="mb-2">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 p-0 text-xs">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight size={12} className="muted shrink-0" aria-hidden />}
              {isLast || !crumb.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={`${isLast ? 'font-extrabold' : 'muted'} max-w-[28ch] truncate`}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="muted inline-flex items-center gap-1 font-bold hover:text-foreground hover:underline"
                >
                  {index === 0 && <Home size={12} aria-hidden />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
