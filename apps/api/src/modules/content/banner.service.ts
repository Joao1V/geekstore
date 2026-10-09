import { type Prisma, prisma } from '@geekstore/db';
import {
  type Banner,
  type BannerBody,
  type BannerUpdateBody,
  bannerWindowIssue,
  type StoreBanner,
} from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';

const ENTITY = 'banner';

type BannerRow = Prisma.BannerGetPayload<object>;

const toBanner = (row: BannerRow): Banner => ({
  banner_id: row.banner_id,
  tag: row.tag,
  headline: row.headline,
  text: row.text,
  cta_label: row.cta_label,
  href: row.href,
  image_url: row.image_url,
  position: row.position,
  is_active: row.is_active,
  starts_at: row.starts_at?.toISOString() ?? null,
  ends_at: row.ends_at?.toISOString() ?? null,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

const snapshot = (row: BannerRow) => ({
  headline: row.headline,
  tag: row.tag,
  text: row.text,
  cta_label: row.cta_label,
  href: row.href,
  image_url: row.image_url,
  position: row.position,
  is_active: row.is_active,
  starts_at: row.starts_at,
  ends_at: row.ends_at,
});

const date = (value: string | null | undefined): Date | null | undefined =>
  value === undefined ? undefined : value === null ? null : new Date(value);

const ORDER = [{ position: 'asc' as const }, { created_at: 'asc' as const }];

export async function listBanners(): Promise<Banner[]> {
  return (await prisma.banner.findMany({ orderBy: ORDER })).map(toBanner);
}

export async function createBanner(actorId: string, body: BannerBody): Promise<Banner> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.banner.aggregate({ _max: { position: true } });
    const created = await tx.banner.create({
      data: {
        ...body,
        starts_at: date(body.starts_at),
        ends_at: date(body.ends_at),
        position: (last._max.position ?? 0) + 1,
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.banner_id,
      action: 'create',
      after: snapshot(created),
    });
    return toBanner(created);
  });
}

export async function updateBanner(
  actorId: string,
  bannerId: string,
  body: BannerUpdateBody
): Promise<Banner> {
  const before = await prisma.banner.findUnique({ where: { banner_id: bannerId } });
  if (!before) throw new NotFoundError('Banner não encontrado.');
  const issue = bannerWindowIssue({
    starts_at:
      body.starts_at !== undefined ? body.starts_at : (before.starts_at?.toISOString() ?? null),
    ends_at: body.ends_at !== undefined ? body.ends_at : (before.ends_at?.toISOString() ?? null),
  });
  if (issue) throw new BadRequestError(issue);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.banner.update({
      where: { banner_id: bannerId },
      data: { ...body, starts_at: date(body.starts_at), ends_at: date(body.ends_at) },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: bannerId,
      action: 'update',
      before: snapshot(before),
      after: snapshot(updated),
    });
    return toBanner(updated);
  });
}

export async function deleteBanner(actorId: string, bannerId: string): Promise<void> {
  const before = await prisma.banner.findUnique({ where: { banner_id: bannerId } });
  if (!before) throw new NotFoundError('Banner não encontrado.');
  await prisma.$transaction(async (tx) => {
    await tx.banner.delete({ where: { banner_id: bannerId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: bannerId,
      action: 'delete',
      before: snapshot(before),
    });
  });
}

/** A lista inteira, na nova ordem. Faltar ou sobrar um id é erro: evita ordenar só uma parte sem querer. */
export async function reorderBanners(
  actorId: string,
  bannerIds: readonly string[]
): Promise<Banner[]> {
  if (new Set(bannerIds).size !== bannerIds.length) {
    throw new BadRequestError('A lista tem banners repetidos.');
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.banner.findMany({ select: { banner_id: true } });
    const known = new Set(existing.map((row) => row.banner_id));
    if (known.size !== bannerIds.length || bannerIds.some((id) => !known.has(id))) {
      throw new BadRequestError('Envie todos os banners, cada um uma vez.');
    }
    for (const [index, id] of bannerIds.entries()) {
      await tx.banner.update({ where: { banner_id: id }, data: { position: index + 1 } });
    }
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: bannerIds[0] as string,
      action: 'update',
      after: { order: bannerIds },
    });
    return (await tx.banner.findMany({ orderBy: ORDER })).map(toBanner);
  });
}

/** Loja: só os ativos que estão dentro da janela de datas, na ordem do admin. */
export async function listActiveBanners(now = new Date()): Promise<StoreBanner[]> {
  const rows = await prisma.banner.findMany({
    where: {
      is_active: true,
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gt: now } }] },
      ],
    },
    orderBy: ORDER,
  });
  return rows.map((row) => ({
    banner_id: row.banner_id,
    tag: row.tag,
    headline: row.headline,
    text: row.text,
    cta_label: row.cta_label,
    href: row.href,
    image_url: row.image_url,
  }));
}
