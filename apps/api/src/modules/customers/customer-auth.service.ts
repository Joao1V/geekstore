import { Prisma, prisma } from '@geekstore/db';
import type { Customer, CustomerLoginBody, CustomerRegisterBody } from '@geekstore/shared';

import { ConflictError, UnauthorizedError } from '../../core/_errors';
import { envConfig } from '../../core/config';
import { hashPassword, verifyPassword } from '../../core/security/password';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  isWithinReuseGrace,
} from '../../core/security/tokens';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type CustomerRow = Prisma.CustomerGetPayload<object>;
export type IssuedRefreshToken = { token: string; expiresAt: Date };

export function toCustomer(row: CustomerRow): Customer {
  return {
    customer_id: row.customer_id,
    email: row.email,
    name: row.name,
    document: row.document,
    phone: row.phone,
    created_at: row.created_at.toISOString(),
  };
}

async function issueRefreshToken(customerId: string): Promise<IssuedRefreshToken> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + envConfig.auth.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY);
  await prisma.customerRefreshToken.create({
    data: { customer_id: customerId, token_hash: hashOpaqueToken(token), expires_at: expiresAt },
  });
  return { token, expiresAt };
}

export async function registerCustomer(body: CustomerRegisterBody): Promise<Customer> {
  try {
    const row = await prisma.customer.create({
      data: {
        email: body.email,
        name: body.name,
        password_hash: await hashPassword(body.password),
        document: body.document ?? null,
        phone: body.phone ?? null,
      },
    });
    return toCustomer(row);
  } catch (error) {
    // O UNIQUE do e-mail é a trava (duas contas ao mesmo tempo não passam as duas).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Já existe uma conta com este e-mail. Entre ou recupere a senha.');
    }
    throw error;
  }
}

export async function verifyCustomerCredentials(body: CustomerLoginBody): Promise<Customer> {
  const row = await prisma.customer.findUnique({ where: { email: body.email } });
  // A mesma mensagem para e-mail desconhecido e senha errada: não revela quais e-mails existem.
  if (!row || !(await verifyPassword(row.password_hash, body.password))) {
    throw new UnauthorizedError('E-mail ou senha incorretos.');
  }
  return toCustomer(row);
}

export function createCustomerSession(customerId: string): Promise<IssuedRefreshToken> {
  return issueRefreshToken(customerId);
}

/** Troca o refresh token por outro novo; token já usado de novo derruba todas as sessões da pessoa. */
export async function rotateCustomerRefreshToken(
  rawToken: string
): Promise<IssuedRefreshToken & { customer: Customer }> {
  const existing = await prisma.customerRefreshToken.findUnique({
    where: { token_hash: hashOpaqueToken(rawToken) },
    include: { customer: true },
  });
  if (!existing) throw new UnauthorizedError('Sessão inválida.');

  // Só token TROCADO há pouco tem a janela; revogado por logout ou por reuso não.
  const withinGrace = existing.rotated_at !== null && isWithinReuseGrace(existing.rotated_at);
  if (existing.revoked_at && !withinGrace) {
    await prisma.customerRefreshToken.updateMany({
      where: { customer_id: existing.customer_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    throw new UnauthorizedError('Sessão inválida.');
  }
  if (existing.expires_at < new Date()) throw new UnauthorizedError('Sessão expirada.');

  if (!existing.revoked_at) {
    const now = new Date();
    await prisma.customerRefreshToken.update({
      where: { customer_refresh_token_id: existing.customer_refresh_token_id },
      data: { revoked_at: now, rotated_at: now },
    });
  }
  return {
    ...(await issueRefreshToken(existing.customer_id)),
    customer: toCustomer(existing.customer),
  };
}

export async function revokeCustomerRefreshToken(rawToken: string): Promise<void> {
  await prisma.customerRefreshToken.updateMany({
    where: { token_hash: hashOpaqueToken(rawToken), revoked_at: null },
    data: { revoked_at: new Date() },
  });
}
