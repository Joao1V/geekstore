import { prisma } from '@geekstore/db';
import type { ForgotPasswordBody, ResetPasswordBody } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';
import { writeOutboxEvent } from '../../core/outbox/outbox';
import { hashPassword } from '../../core/security/password';
import { readToken, signToken } from '../../core/security/signed-token';

const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 3;
const INVALID_LINK = 'Este link não é válido ou já expirou. Peça um novo.';

const TOKEN_PURPOSE = 'password-reset';

export const signResetToken = (resetId: string): string => signToken(TOKEN_PURPOSE, resetId);

/**
 * Pede uma nova senha. A resposta é sempre a mesma, exista a conta ou não (não revela quais e-mails
 * têm cadastro). O e-mail sai pelo outbox; no máximo {@link MAX_REQUESTS_PER_HOUR} pedidos por hora.
 */
export async function requestPasswordReset(body: ForgotPasswordBody): Promise<void> {
  const customer = await prisma.customer.findUnique({ where: { email: body.email } });
  if (!customer) return;
  const recent = await prisma.passwordReset.count({
    where: {
      customer_id: customer.customer_id,
      created_at: { gt: new Date(Date.now() - RESET_TTL_MS) },
    },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return;

  await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordReset.create({
      data: {
        customer_id: customer.customer_id,
        expires_at: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await writeOutboxEvent(tx, {
      type: 'customer.password_reset_requested',
      entityType: 'customer',
      entityId: customer.customer_id,
      payload: { password_reset_id: reset.password_reset_id },
    });
  });
}

/** Troca a senha com o link do e-mail. Vale uma vez; e derruba as sessões abertas da conta. */
export async function resetPassword(body: ResetPasswordBody): Promise<void> {
  const resetId = readToken(TOKEN_PURPOSE, body.token);
  if (!resetId) throw new BadRequestError(INVALID_LINK);

  const passwordHash = await hashPassword(body.password);
  await prisma.$transaction(async (tx) => {
    // O UPDATE condicional é a trava: dois usos ao mesmo tempo, só um passa.
    const claimed = await tx.passwordReset.updateMany({
      where: { password_reset_id: resetId, used_at: null, expires_at: { gt: new Date() } },
      data: { used_at: new Date() },
    });
    if (claimed.count === 0) throw new BadRequestError(INVALID_LINK);
    const reset = await tx.passwordReset.findUniqueOrThrow({
      where: { password_reset_id: resetId },
    });
    await tx.customer.update({
      where: { customer_id: reset.customer_id },
      data: { password_hash: passwordHash },
    });
    await tx.customerRefreshToken.updateMany({
      where: { customer_id: reset.customer_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  });
}
