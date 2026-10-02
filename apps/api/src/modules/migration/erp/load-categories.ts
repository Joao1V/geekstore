import { prisma } from '@geekstore/db';

import type { PlannedCategory } from './plan-types';

/**
 * Cria as categorias do plano que ainda não existem e devolve `chave do plano -> category_id`.
 * Reaproveita por (nome, pai) em vez de por slug, para reexecuções não duplicarem nem renomearem.
 * Os pais vêm antes dos filhos no plano.
 */
export async function resolveCategories(planned: PlannedCategory[]) {
  const ids = new Map<string, string>();
  let created = 0;

  for (const category of planned) {
    const parentId = category.parentKey ? (ids.get(category.parentKey) ?? null) : null;
    const existing = await prisma.category.findFirst({
      where: { name: category.name, parent_id: parentId },
      select: { category_id: true },
    });
    if (existing) {
      ids.set(category.key, existing.category_id);
      continue;
    }

    const slug = await freeSlug(category.slug);
    const row = await prisma.category.create({
      data: { name: category.name, slug, parent_id: parentId, position: category.position },
      select: { category_id: true },
    });
    ids.set(category.key, row.category_id);
    created += 1;
  }
  return { ids, created, reused: planned.length - created };
}

async function freeSlug(base: string): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await prisma.category.findUnique({ where: { slug }, select: { category_id: true } })))
      return slug;
  }
  throw new Error(`Sem slug livre para a categoria "${base}".`);
}
