import { CATEGORY_CATALOG } from '@geekstore/db';

import type { PlannedCategory } from './plan-types';

/**
 * As categorias do plano são as da NOSSA taxonomia (packages/db/src/category-catalog.ts), com a
 * contagem de produtos que o importador colocou em cada uma. O ERP não cria categoria nenhuma.
 */
export function planCategories(items: readonly { categoryKey: string }[]): PlannedCategory[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.categoryKey, (counts.get(item.categoryKey) ?? 0) + 1);

  return CATEGORY_CATALOG.flatMap((root, rootPosition) => [
    {
      key: root.slug,
      parentKey: null,
      name: root.name,
      slug: root.slug,
      position: rootPosition,
      productCount: counts.get(root.slug) ?? 0,
    },
    ...(root.children ?? []).map((child, position) => ({
      key: child.slug,
      parentKey: root.slug,
      name: child.name,
      slug: child.slug,
      position,
      productCount: counts.get(child.slug) ?? 0,
    })),
  ]);
}
