import { type Prisma, prisma } from '@geekstore/db';
import {
  type Coupon,
  type CouponBody,
  type CouponListQuery,
  type CouponStatus,
  type CouponUpdateBody,
  couponRuleIssue,
  type Paginated,
} from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';

const ENTITY = 'coupon';
const SORT_FIELDS = ['created_at', 'code', 'uses'] as const;

type CouponRow = Prisma.CouponGetPayload<object>;

/** "Posso usar agora?": o motivo mais forte vence (desativado antes de vencido, vencido antes de esgotado). */
export function couponStatus(row: CouponRow, now: Date): CouponStatus {
  if (!row.is_active) return 'inactive';
  if (row.ends_at && row.ends_at < now) return 'expired';
  if (row.max_uses !== null && row.uses >= row.max_uses) return 'exhausted';
  if (row.starts_at && row.starts_at > now) return 'scheduled';
  return 'active';
}

const toCoupon = (row: CouponRow, now: Date): Coupon => ({
  coupon_id: row.coupon_id,
  code: row.code,
  kind: row.kind,
  value: row.value,
  min_subtotal_cents: row.min_subtotal_cents,
  max_uses: row.max_uses,
  uses: row.uses,
  starts_at: row.starts_at?.toISOString() ?? null,
  ends_at: row.ends_at?.toISOString() ?? null,
  is_active: row.is_active,
  status: couponStatus(row, now),
  created_at: row.created_at.toISOString(),
});

const snapshot = (row: CouponRow) => ({
  code: row.code,
  kind: row.kind,
  value: row.value,
  min_subtotal_cents: row.min_subtotal_cents,
  max_uses: row.max_uses,
  starts_at: row.starts_at,
  ends_at: row.ends_at,
  is_active: row.is_active,
});

const date = (value: string | null | undefined): Date | null | undefined =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/** A tabela é pequena (dezenas de cupons): o filtro por situação é feito aqui, já com o status derivado. */
export async function listCoupons(query: CouponListQuery): Promise<Paginated<Coupon>> {
  const { field, direction } = parseSort(query.sort, SORT_FIELDS, {
    field: 'created_at',
    direction: 'desc',
  });
  const rows = await prisma.coupon.findMany({
    where: query.q ? { code: { contains: query.q, mode: 'insensitive' } } : {},
    orderBy: [{ [field]: direction }, { coupon_id: 'asc' }],
  });
  const now = new Date();
  const all = rows
    .map((row) => toCoupon(row, now))
    .filter((c) => !query.status || c.status === query.status);
  const { skip, take } = skipTake(query.page, query.page_size);
  return {
    data: all.slice(skip, skip + take),
    meta: buildMeta(query.page, query.page_size, all.length),
  };
}

async function assertCodeFree(code: string, exceptId?: string): Promise<void> {
  const taken = await prisma.coupon.findFirst({
    where: { code, ...(exceptId ? { NOT: { coupon_id: exceptId } } : {}) },
    select: { coupon_id: true },
  });
  if (taken) throw new ConflictError(`Já existe um cupom com o código ${code}.`);
}

export async function createCoupon(actorId: string, body: CouponBody): Promise<Coupon> {
  await assertCodeFree(body.code);
  return prisma.$transaction(async (tx) => {
    const created = await tx.coupon.create({
      data: {
        code: body.code,
        kind: body.kind,
        value: body.kind === 'free_shipping' ? 0 : body.value,
        min_subtotal_cents: body.min_subtotal_cents,
        max_uses: body.max_uses,
        starts_at: date(body.starts_at),
        ends_at: date(body.ends_at),
        is_active: body.is_active,
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.coupon_id,
      action: 'create',
      after: snapshot(created),
    });
    return toCoupon(created, new Date());
  });
}

export async function updateCoupon(
  actorId: string,
  couponId: string,
  body: CouponUpdateBody
): Promise<Coupon> {
  const before = await prisma.coupon.findUnique({ where: { coupon_id: couponId } });
  if (!before) throw new NotFoundError('Cupom não encontrado.');
  if (body.code !== undefined && body.code !== before.code) {
    if (before.uses > 0) {
      throw new BadRequestError('O código de um cupom já usado não muda: crie outro cupom.');
    }
    await assertCodeFree(body.code, couponId);
  }

  // A regra que mistura campos (tipo x valor, início x fim) vale para o cupom já mesclado.
  const kind = body.kind ?? before.kind;
  const merged = {
    kind,
    value: kind === 'free_shipping' ? 0 : (body.value ?? before.value),
    starts_at:
      body.starts_at !== undefined ? body.starts_at : (before.starts_at?.toISOString() ?? null),
    ends_at: body.ends_at !== undefined ? body.ends_at : (before.ends_at?.toISOString() ?? null),
  };
  const issue = couponRuleIssue(merged);
  if (issue) throw new BadRequestError(issue);
  if (body.max_uses != null && body.max_uses < before.uses) {
    throw new BadRequestError(
      `O cupom já foi usado ${before.uses} vez(es): o limite não pode ser menor.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coupon.update({
      where: { coupon_id: couponId },
      data: {
        ...(body.code !== undefined ? { code: body.code } : {}),
        kind,
        value: merged.value,
        ...(body.min_subtotal_cents !== undefined
          ? { min_subtotal_cents: body.min_subtotal_cents }
          : {}),
        ...(body.max_uses !== undefined ? { max_uses: body.max_uses } : {}),
        ...(body.starts_at !== undefined ? { starts_at: date(body.starts_at) } : {}),
        ...(body.ends_at !== undefined ? { ends_at: date(body.ends_at) } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: couponId,
      action: 'update',
      before: snapshot(before),
      after: snapshot(updated),
    });
    return toCoupon(updated, new Date());
  });
}

/** Cupom que já foi usado vira histórico do pedido: só se desativa. O que nunca foi usado pode sair. */
export async function deleteCoupon(actorId: string, couponId: string): Promise<void> {
  const before = await prisma.coupon.findUnique({ where: { coupon_id: couponId } });
  if (!before) throw new NotFoundError('Cupom não encontrado.');
  if (before.uses > 0) {
    throw new ConflictError('Este cupom já foi usado: desative em vez de apagar.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.coupon.delete({ where: { coupon_id: couponId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: couponId,
      action: 'delete',
      before: snapshot(before),
    });
  });
}
