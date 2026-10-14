import type { PaginationMeta } from '@geekstore/shared';
import { Pagination } from '@heroui/react';

const SIBLINGS = 1;

/** Janela de páginas: primeira, última e as vizinhas da atual; o resto vira reticências. */
function pageWindow(page: number, total: number): Array<number | 'gap-start' | 'gap-end'> {
  const pages = new Set<number>([1, total]);
  for (let n = page - SIBLINGS; n <= page + SIBLINGS; n += 1) {
    if (n >= 1 && n <= total) pages.add(n);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((n, index) => {
    const previous = sorted[index - 1];
    if (previous === undefined || n - previous === 1) return [n];
    return [previous + 1 === n - 1 ? previous + 1 : index === 1 ? 'gap-start' : 'gap-end', n];
  });
}

export function PaginationBar({
  meta,
  onPage,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, meta.total_pages);
  return (
    <Pagination className="mt-4 flex-wrap gap-3" aria-label="Paginação">
      <Pagination.Summary>
        {meta.total} {meta.total === 1 ? 'registro' : 'registros'}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={meta.page <= 1} onPress={() => onPage(meta.page - 1)}>
            <Pagination.PreviousIcon />
            <span className="max-md:hidden">Anterior</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pageWindow(meta.page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <Pagination.Item key={item}>
              <Pagination.Link isActive={item === meta.page} onPress={() => onPage(item)}>
                {item}
              </Pagination.Link>
            </Pagination.Item>
          ) : (
            <Pagination.Item key={item}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          )
        )}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={meta.page >= totalPages}
            onPress={() => onPage(meta.page + 1)}
          >
            <span className="max-md:hidden">Próxima</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
