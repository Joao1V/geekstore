import type { Prisma, prisma } from '@geekstore/db';
import type { CouponCheck } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';

type Tx = Prisma.TransactionClient | typeof prisma;

/** Confere o cupom para este subtotal e calcula o desconto. Não consome o uso (isso é no pedido). */
export async function checkCoupon(
  db: Tx,
  code: string,
  subtotalCents: number
): Promise<CouponCheck> {
  const coupon = await db.coupon.findUnique({ where: { code } });
  const now = new Date();
  // A mesma mensagem para cupom inexistente, vencido ou esgotado: não revela quais códigos existem.
  const invalid = new BadRequestError('Cupom inválido ou expirado.');
  if (!coupon || !coupon.is_active) throw invalid;
  if (coupon.starts_at && coupon.starts_at > now) throw invalid;
  if (coupon.ends_at && coupon.ends_at < now) throw invalid;
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) throw invalid;
  if (subtotalCents < coupon.min_subtotal_cents) {
    throw new BadRequestError('O pedido ainda não atingiu o valor mínimo deste cupom.');
  }
  const discount =
    coupon.kind === 'percent'
      ? Math.round((subtotalCents * Math.min(coupon.value, 100)) / 100)
      : coupon.kind === 'amount'
        ? Math.min(coupon.value, subtotalCents)
        : 0;
  return {
    code: coupon.code,
    kind: coupon.kind,
    discount_cents: discount,
    free_shipping: coupon.kind === 'free_shipping',
  };
}

/** Consome um uso do cupom; o UPDATE condicional impede passar do limite com pedidos simultâneos. */
export async function consumeCoupon(tx: Prisma.TransactionClient, code: string): Promise<void> {
  const used = await tx.$executeRaw`
    UPDATE coupon SET uses = uses + 1
    WHERE code = ${code} AND (max_uses IS NULL OR uses < max_uses)`;
  if (used === 0) throw new BadRequestError('Cupom inválido ou expirado.');
}
