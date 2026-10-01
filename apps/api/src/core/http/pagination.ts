import type { PaginationMeta } from '@geekstore/shared';

import { BadRequestError } from '../_errors';

export function buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) };
}

export function skipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export type SortSpec<F extends string> = { field: F; direction: 'asc' | 'desc' };

/**
 * Lê `campo:asc|desc` validando o campo contra a lista permitida do recurso.
 * Sem `sort`, devolve `fallback`. Valor inválido é 400 (nunca ignorado em silêncio).
 */
export function parseSort<F extends string>(
  sort: string | undefined,
  allowed: readonly F[],
  fallback: SortSpec<F>
): SortSpec<F> {
  if (!sort) return fallback;

  const [field, direction = 'asc', ...rest] = sort.split(':');
  const isValidField = (allowed as readonly string[]).includes(field ?? '');
  const isValidDirection = direction === 'asc' || direction === 'desc';
  if (!isValidField || !isValidDirection || rest.length > 0) {
    throw new BadRequestError(
      `sort inválido. Use campo:asc|desc com campo em: ${allowed.join(', ')}.`
    );
  }
  return { field: field as F, direction };
}
