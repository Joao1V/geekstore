import { type Prisma, prisma } from '@geekstore/db';
import type {
  Page,
  PageBody,
  PageListItem,
  PageUpdateBody,
  StorePage,
  StorePageLink,
} from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';

const ENTITY = 'page';

type PageRow = Prisma.PageGetPayload<object>;

const toPage = (row: PageRow): Page => ({
  page_id: row.page_id,
  slug: row.slug,
  title: row.title,
  body: row.body,
  status: row.status,
  seo_title: row.seo_title,
  seo_description: row.seo_description,
  position: row.position,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

const snapshot = (row: PageRow) => ({
  slug: row.slug,
  title: row.title,
  status: row.status,
  position: row.position,
  seo_title: row.seo_title,
  seo_description: row.seo_description,
  // O corpo pode ser longo: o log guarda o tamanho, não o texto inteiro.
  body_length: row.body.length,
});

export async function listPages(): Promise<PageListItem[]> {
  const rows = await prisma.page.findMany({
    orderBy: [{ position: 'asc' }, { title: 'asc' }],
    select: {
      page_id: true,
      slug: true,
      title: true,
      status: true,
      position: true,
      updated_at: true,
    },
  });
  return rows.map((row) => ({ ...row, updated_at: row.updated_at.toISOString() }));
}

export async function getPage(pageId: string): Promise<Page> {
  const row = await prisma.page.findUnique({ where: { page_id: pageId } });
  if (!row) throw new NotFoundError('Página não encontrada.');
  return toPage(row);
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  const taken = await prisma.page.findFirst({
    where: { slug, ...(exceptId ? { NOT: { page_id: exceptId } } : {}) },
    select: { page_id: true },
  });
  if (taken) throw new ConflictError('Já existe uma página com esse endereço.');
}

/** Não vai ao ar uma página sem texto: a loja mostraria um título e mais nada. */
function assertPublishable(status: string, body: string): void {
  if (status === 'published' && body.trim() === '') {
    throw new BadRequestError('Escreva o conteúdo antes de publicar a página.');
  }
}

export async function createPage(actorId: string, body: PageBody): Promise<Page> {
  await assertSlugFree(body.slug);
  assertPublishable(body.status, body.body);
  return prisma.$transaction(async (tx) => {
    const created = await tx.page.create({ data: body });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.page_id,
      action: 'create',
      after: snapshot(created),
    });
    return toPage(created);
  });
}

export async function updatePage(
  actorId: string,
  pageId: string,
  body: PageUpdateBody
): Promise<Page> {
  const before = await prisma.page.findUnique({ where: { page_id: pageId } });
  if (!before) throw new NotFoundError('Página não encontrada.');
  if (body.slug !== undefined && body.slug !== before.slug) {
    if (before.status === 'published') {
      throw new BadRequestError('Uma página publicada não troca de endereço: despublique antes.');
    }
    await assertSlugFree(body.slug, pageId);
  }
  assertPublishable(body.status ?? before.status, body.body ?? before.body);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.page.update({ where: { page_id: pageId }, data: body });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: pageId,
      action: 'update',
      before: snapshot(before),
      after: snapshot(updated),
    });
    return toPage(updated);
  });
}

/** Só rascunho se apaga: uma página no ar tem endereço em uso (links, buscadores). */
export async function deletePage(actorId: string, pageId: string): Promise<void> {
  const before = await prisma.page.findUnique({ where: { page_id: pageId } });
  if (!before) throw new NotFoundError('Página não encontrada.');
  if (before.status === 'published') {
    throw new ConflictError('Despublique a página antes de apagar.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.page.delete({ where: { page_id: pageId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: pageId,
      action: 'delete',
      before: snapshot(before),
    });
  });
}

// ── Loja (público) ──────────────────────────────────────────────────────────

export async function listPublishedPages(): Promise<StorePageLink[]> {
  return prisma.page.findMany({
    where: { status: 'published' },
    orderBy: [{ position: 'asc' }, { title: 'asc' }],
    select: { slug: true, title: true },
  });
}

export async function getPublishedPage(slug: string): Promise<StorePage> {
  const row = await prisma.page.findFirst({ where: { slug, status: 'published' } });
  // Rascunho e inexistente respondem igual: a loja não revela o que ainda não foi publicado.
  if (!row) throw new NotFoundError('Página não encontrada.');
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    updated_at: row.updated_at.toISOString(),
  };
}
