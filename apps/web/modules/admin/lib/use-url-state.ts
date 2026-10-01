'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/** Estado de listagem na URL (filtros, ordenação, página): compartilhável e sobrevive ao reload. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | number | null | undefined>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  return { searchParams, setParams, page };
}

/** `campo:asc` -> alterna asc/desc; um campo novo começa em asc. */
export function nextSort(current: string | null, field: string): string {
  return current === `${field}:asc` ? `${field}:desc` : `${field}:asc`;
}
