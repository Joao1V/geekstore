import { prisma } from '@geekstore/db';
import type { Category, CategoryBody, CategoryUpdateBody } from '@geekstore/shared';
import { ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { toCategory } from './catalog.mappers';
import { assertValidPlacement } from './category-tree';

const ENTITY = 'category';

export async function listCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  return rows.map(toCategory);
}

async function assertSlugAvailable(slug: string, exceptId?: string): Promise<void> {
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing && existing.category_id !== exceptId) {
    throw new ConflictError('Já existe uma categoria com esse slug.');
  }
}

async function loadTreeNodes() {
  return prisma.category.findMany({ select: { category_id: true, parent_id: true } });
}

export async function createCategory(actorId: string, body: CategoryBody): Promise<Category> {
  await assertSlugAvailable(body.slug);
  assertValidPlacement(await loadTreeNodes(), null, body.parent_id);

  return prisma.$transaction(async (tx) => {
    const created = await tx.category.create({ data: body });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.category_id,
      action: 'create',
      after: created,
    });
    return toCategory(created);
  });
}

export async function updateCategory(
  actorId: string,
  categoryId: string,
  body: CategoryUpdateBody
): Promise<Category> {
  const before = await prisma.category.findUnique({ where: { category_id: categoryId } });
  if (!before) throw new NotFoundError('Categoria não encontrada.');

  if (body.slug !== undefined) await assertSlugAvailable(body.slug, categoryId);
  if (body.parent_id !== undefined && body.parent_id !== before.parent_id) {
    assertValidPlacement(await loadTreeNodes(), categoryId, body.parent_id);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({ where: { category_id: categoryId }, data: body });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: categoryId,
      action: 'update',
      before,
      after: updated,
    });
    return toCategory(updated);
  });
}

export async function deleteCategory(actorId: string, categoryId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.category.findUnique({
      where: { category_id: categoryId },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!before) throw new NotFoundError('Categoria não encontrada.');
    if (before._count.children > 0 || before._count.products > 0) {
      throw new ConflictError('A categoria tem subcategorias ou produtos e não pode ser excluída.');
    }

    const { _count, ...row } = before;
    await tx.category.delete({ where: { category_id: categoryId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: categoryId,
      action: 'delete',
      before: row,
    });
  });
}
