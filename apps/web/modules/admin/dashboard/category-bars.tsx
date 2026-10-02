import type { CatalogDashboard } from '@geekstore/shared';
import Link from 'next/link';

import { formatInteger } from '../lib/format';

const MAX_ROWS = 8;

/** Onde estão os produtos: as pastas raiz, da maior para a menor, cada uma levando à lista. */
export function CategoryBars({ categories }: { categories: CatalogDashboard['by_category'] }) {
  const rows = categories.slice(0, MAX_ROWS);
  const max = Math.max(1, ...rows.map((row) => row.product_count));
  const rest = categories.slice(MAX_ROWS).reduce((sum, row) => sum + row.product_count, 0);

  return (
    <section
      className="surface grid content-start gap-4 p-6 max-md:p-4"
      aria-labelledby="by-category"
    >
      <div>
        <h2 id="by-category" className="text-xl font-extrabold">
          Produtos por pasta
        </h2>
        <p className="muted text-sm">Clique para ver a lista.</p>
      </div>
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.category_id}>
            <Link
              href={`/admin/produtos/?category_id=${row.category_id}`}
              className="group grid gap-1"
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-extrabold group-hover:underline">{row.name}</span>
                <span className="muted tabular-nums">{formatInteger(row.product_count)}</span>
              </span>
              <span className="block h-2 overflow-hidden rounded-full bg-surface-secondary">
                <span
                  className="block h-full rounded-full bg-geek-yellow"
                  style={{ width: `${(row.product_count / max) * 100}%` }}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="muted text-xs">+ {formatInteger(rest)} produtos em outras pastas</p>
      )}
    </section>
  );
}
