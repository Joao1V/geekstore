import { type Prisma, prisma } from '@geekstore/db';
import {
  normalizeRedirectPath,
  type Paginated,
  type Redirect,
  type RedirectBody,
  type RedirectListQuery,
  type RedirectMap,
  type RedirectUpdateBody,
} from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';

const ENTITY = 'redirect';
const SORT_FIELDS = ['from_path', 'to_path', 'created_at'] as const;
const MAX_CHAIN = 10;

type Row = Prisma.RedirectGetPayload<object>;

const toRedirect = (row: Row): Redirect => ({
  redirect_id: row.redirect_id,
  from_path: row.from_path,
  to_path: row.to_path,
  source: row.source,
  note: row.note,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

const snapshot = (row: Row) => ({
  from_path: row.from_path,
  to_path: row.to_path,
  source: row.source,
  note: row.note,
});

/**
 * Um redirecionamento que, seguido adiante, volta para a própria origem nunca termina no navegador.
 * Segue o destino pelos que já existem (sem contar o que está sendo editado) até achar o fim ou a origem.
 */
export function wouldLoop(
  from: string,
  to: string,
  existing: ReadonlyMap<string, string>
): boolean {
  let current = normalizeRedirectPath(to);
  for (let step = 0; step < MAX_CHAIN; step += 1) {
    if (current === from) return true;
    const next = existing.get(current);
    if (!next) return false;
    current = normalizeRedirectPath(next);
  }
  return true; // cadeia comprida demais: tratada como laço
}

async function assertValid(from: string, to: string, exceptId?: string): Promise<void> {
  if (normalizeRedirectPath(to) === from) {
    throw new BadRequestError('O endereço novo é igual ao antigo.');
  }
  const others = await prisma.redirect.findMany({
    where: exceptId ? { NOT: { redirect_id: exceptId } } : {},
    select: { from_path: true, to_path: true },
  });
  const map = new Map(others.map((row) => [row.from_path, row.to_path]));
  if (wouldLoop(from, to, map)) {
    throw new BadRequestError('Este redirecionamento formaria um laço com outros já cadastrados.');
  }
}

async function assertFromFree(from: string, exceptId?: string): Promise<void> {
  const taken = await prisma.redirect.findFirst({
    where: { from_path: from, ...(exceptId ? { NOT: { redirect_id: exceptId } } : {}) },
    select: { redirect_id: true },
  });
  if (taken) throw new ConflictError('Já existe um redirecionamento para esse endereço antigo.');
}

export async function listRedirects(query: RedirectListQuery): Promise<Paginated<Redirect>> {
  const { field, direction } = parseSort(query.sort, SORT_FIELDS, {
    field: 'from_path',
    direction: 'asc',
  });
  const where: Prisma.RedirectWhereInput = {
    ...(query.source ? { source: query.source } : {}),
    ...(query.q
      ? {
          OR: [
            { from_path: { contains: query.q, mode: 'insensitive' } },
            { to_path: { contains: query.q, mode: 'insensitive' } },
            { note: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.redirect.findMany({
      where,
      orderBy: [{ [field]: direction }, { redirect_id: 'asc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.redirect.count({ where }),
  ]);
  return { data: rows.map(toRedirect), meta: buildMeta(query.page, query.page_size, total) };
}

export async function createRedirect(actorId: string, body: RedirectBody): Promise<Redirect> {
  await assertFromFree(body.from_path);
  await assertValid(body.from_path, body.to_path);
  return prisma.$transaction(async (tx) => {
    const created = await tx.redirect.create({ data: { ...body, source: 'manual' } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.redirect_id,
      action: 'create',
      after: snapshot(created),
    });
    return toRedirect(created);
  });
}

export async function updateRedirect(
  actorId: string,
  redirectId: string,
  body: RedirectUpdateBody
): Promise<Redirect> {
  const before = await prisma.redirect.findUnique({ where: { redirect_id: redirectId } });
  if (!before) throw new NotFoundError('Redirecionamento não encontrado.');
  const from = body.from_path ?? before.from_path;
  const to = body.to_path ?? before.to_path;
  if (from !== before.from_path) await assertFromFree(from, redirectId);
  await assertValid(from, to, redirectId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.redirect.update({ where: { redirect_id: redirectId }, data: body });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: redirectId,
      action: 'update',
      before: snapshot(before),
      after: snapshot(updated),
    });
    return toRedirect(updated);
  });
}

export async function deleteRedirect(actorId: string, redirectId: string): Promise<void> {
  const before = await prisma.redirect.findUnique({ where: { redirect_id: redirectId } });
  if (!before) throw new NotFoundError('Redirecionamento não encontrado.');
  await prisma.$transaction(async (tx) => {
    await tx.redirect.delete({ where: { redirect_id: redirectId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: redirectId,
      action: 'delete',
      before: snapshot(before),
    });
  });
}

/** O mapa inteiro, para o site guardar em memória. São centenas de linhas curtas. */
export async function redirectMap(): Promise<RedirectMap> {
  const rows = await prisma.redirect.findMany({
    select: { from_path: true, to_path: true },
    orderBy: { from_path: 'asc' },
  });
  return rows.map((row) => [row.from_path, row.to_path]);
}
