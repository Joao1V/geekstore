import type { PaginationMeta } from '@geekstore/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const WINDOW = 2;
const LINK = 'flex size-10 items-center justify-center rounded-lg border text-sm font-extrabold';

/** Números de página em volta da atual: 1 … 4 5 [6] 7 8 … 40. */
function pagesAround(current: number, total: number): (number | null)[] {
  const wanted = new Set([
    1,
    total,
    ...Array.from({ length: 2 * WINDOW + 1 }, (_, i) => current - WINDOW + i),
  ]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  return pages.flatMap((page, index) =>
    index > 0 && page - (pages[index - 1] ?? 0) > 1 ? [null, page] : [page]
  );
}

/** Paginação por links (funciona sem JavaScript e cada página tem URL própria). */
export function Pagination({
  meta,
  hrefFor,
}: {
  meta: PaginationMeta;
  hrefFor: (page: number) => string;
}) {
  if (meta.total_pages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {meta.page > 1 && (
        <Link
          href={hrefFor(meta.page - 1)}
          className={`${LINK} border-border bg-surface`}
          aria-label="Página anterior"
        >
          <ChevronLeft size={18} />
        </Link>
      )}
      {pagesAround(meta.page, meta.total_pages).map((page, index) =>
        page === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: reticências não têm identidade própria
          <span key={`gap-${index}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={hrefFor(page)}
            aria-current={page === meta.page ? 'page' : undefined}
            className={`${LINK} ${page === meta.page ? 'border-geek-yellow bg-geek-yellow text-ink' : 'border-border bg-surface hover:border-ink'}`}
          >
            {page}
          </Link>
        )
      )}
      {meta.page < meta.total_pages && (
        <Link
          href={hrefFor(meta.page + 1)}
          className={`${LINK} border-border bg-surface`}
          aria-label="Próxima página"
        >
          <ChevronRight size={18} />
        </Link>
      )}
    </nav>
  );
}
