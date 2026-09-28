import { prisma } from '@geekstore/db';
import type { AuthUser } from '@geekstore/shared';

import { UnauthorizedError } from '../../core/_errors';
import { envConfig } from '../../core/config';
import { verifyPassword } from '../../core/security/password';
import { generateOpaqueToken, hashOpaqueToken } from '../../core/security/tokens';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type IssuedRefreshToken = {
  token: string;
  expiresAt: Date;
};

function toAuthUser(user: { user_id: string; email: string; name: string }): AuthUser {
  return { userId: user.user_id, email: user.email, name: user.name };
}

function newRefreshTokenExpiry(): Date {
  return new Date(Date.now() + envConfig.auth.REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY);
}

async function issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
  const token = generateOpaqueToken();
  const expiresAt = newRefreshTokenExpiry();

  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hashOpaqueToken(token),
      expires_at: expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function verifyCredentials(email: string, password: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(user.password_hash, password))) {
    throw new UnauthorizedError('Credenciais inválidas.');
  }

  return toAuthUser(user);
}

export async function createSession(userId: string): Promise<IssuedRefreshToken> {
  return issueRefreshToken(userId);
}

export async function rotateRefreshToken(
  rawToken: string
): Promise<IssuedRefreshToken & { user: AuthUser }> {
  const tokenHash = hashOpaqueToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw new UnauthorizedError('Sessão inválida.');
  }

  if (existing.revoked_at) {
    // Token já revogado sendo apresentado de novo: sinal de reuso/roubo. Revoga tudo do usuário.
    await prisma.refreshToken.updateMany({
      where: { user_id: existing.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    throw new UnauthorizedError('Sessão inválida.');
  }

  if (existing.expires_at < new Date()) {
    throw new UnauthorizedError('Sessão expirada.');
  }

  await prisma.refreshToken.update({
    where: { refresh_token_id: existing.refresh_token_id },
    data: { revoked_at: new Date() },
  });

  const issued = await issueRefreshToken(existing.user_id);
  return { ...issued, user: toAuthUser(existing.user) };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { token_hash: tokenHash, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}
