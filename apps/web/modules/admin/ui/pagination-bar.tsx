import type { PaginationMeta } from '@geekstore/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_BUTTON =
  'flex size-9 items-center justify-center rounded-lg border border-border bg-surface disabled:opacity-40';

export function PaginationBar({
  meta,
  onPage,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex items-center justify-between gap-3 text-sm text-muted"
    >
      <span>
        {meta.total} {meta.total === 1 ? 'registro' : 'registros'}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={PAGE_BUTTON}
          aria-label="Página anterior"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span aria-live="polite">
          Página {meta.page} de {Math.max(1, meta.total_pages)}
        </span>
        <button
          type="button"
          className={PAGE_BUTTON}
          aria-label="Próxima página"
          disabled={meta.page >= meta.total_pages}
          onClick={() => onPage(meta.page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
