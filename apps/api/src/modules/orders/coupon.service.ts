import type { Prisma, prisma } from '@geekstore/db';
import type { CouponCheck } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';
import { descendantIds } from '../catalog/category-tree';

type Tx = Prisma.TransactionClient | typeof prisma;

/** Uma linha do carrinho para o cupom: a categoria do produto e o total da linha (preço do servidor). */
export type CouponLine = { category_id: string; total_cents: number };

async function eligibleCategoryIds(
  db: Tx,
  couponId: string
): Promise<{ ids: Set<string>; names: string[] } | null> {
  const links = await db.couponCategory.findMany({
    where: { coupon_id: couponId },
    select: { category: { select: { category_id: true, name: true } } },
  });
  if (links.length === 0) return null;
  const tree = await db.category.findMany({ select: { category_id: true, parent_id: true } });
  const ids = new Set(links.flatMap((link) => descendantIds(tree, link.category.category_id)));
  return { ids, names: links.map((link) => link.category.name) };
}

/**
 * Confere o cupom para este carrinho e calcula o desconto. Não consome o uso (isso é no pedido).
 * Com categorias, o desconto e o pedido mínimo valem só para os itens dessas categorias (e das
 * subcategorias); sem nenhum item delas o cupom é recusado.
 */
export async function checkCoupon(
  db: Tx,
  code: string,
  lines: readonly CouponLine[]
): Promise<CouponCheck> {
  const coupon = await db.coupon.findUnique({ where: { code } });
  const now = new Date();
  // A mesma mensagem para cupom inexistente, vencido ou esgotado: não revela quais códigos existem.
  const invalid = new BadRequestError('Cupom inválido ou expirado.');
  if (!coupon || !coupon.is_active) throw invalid;
  if (coupon.starts_at && coupon.starts_at > now) throw invalid;
  if (coupon.ends_at && coupon.ends_at < now) throw invalid;
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) throw invalid;

  const scope = await eligibleCategoryIds(db, coupon.coupon_id);
  const eligible = scope ? lines.filter((line) => scope.ids.has(line.category_id)) : lines;
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.total_cents, 0);
  if (scope && eligible.length === 0) {
    throw new BadRequestError(`Este cupom vale só para produtos de: ${scope.names.join(', ')}.`);
  }
  if (eligibleSubtotal < coupon.min_subtotal_cents) {
    throw new BadRequestError(
      scope
        ? 'Os itens deste cupom ainda não atingiram o valor mínimo dele.'
        : 'O pedido ainda não atingiu o valor mínimo deste cupom.'
    );
  }
  const discount =
    coupon.kind === 'percent'
      ? Math.round((eligibleSubtotal * Math.min(coupon.value, 100)) / 100)
      : coupon.kind === 'amount'
        ? Math.min(coupon.value, eligibleSubtotal)
        : 0;
  return {
    code: coupon.code,
    kind: coupon.kind,
    discount_cents: discount,
    free_shipping: coupon.kind === 'free_shipping',
    eligible_subtotal_cents: eligibleSubtotal,
  };
}

/** Consome um uso do cupom; o UPDATE condicional impede passar do limite com pedidos simultâneos. */
export async function consumeCoupon(tx: Prisma.TransactionClient, code: string): Promise<void> {
  const used = await tx.$executeRaw`
    UPDATE coupon SET uses = uses + 1
    WHERE code = ${code} AND (max_uses IS NULL OR uses < max_uses)`;
  if (used === 0) throw new BadRequestError('Cupom inválido ou expirado.');
}
