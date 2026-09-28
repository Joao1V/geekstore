import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashPassword } from '../../core/security/password';
import {
  createSession,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyCredentials,
} from './auth.service';

describe('auth.service (integration — requires a live DATABASE_URL)', () => {
  const email = `auth-test-${randomUUID()}@geekstore.local`;
  const password = 'senha-teste-123';
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email, password_hash: await hashPassword(password), name: 'Teste Auth' },
    });
    userId = user.user_id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    await prisma.user.delete({ where: { user_id: userId } });
    await prisma.$disconnect();
  });

  it('rejects an unknown email', async () => {
    await expect(verifyCredentials('nao-existe@geekstore.local', password)).rejects.toThrow();
  });

  it('rejects the wrong password', async () => {
    await expect(verifyCredentials(email, 'senha-errada')).rejects.toThrow();
  });

  it('accepts the correct credentials', async () => {
    const user = await verifyCredentials(email, password);
    expect(user.email).toBe(email);
    expect(user.userId).toBe(userId);
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const first = await createSession(userId);
    const rotated = await rotateRefreshToken(first.token);

    expect(rotated.token).not.toBe(first.token);
    expect(rotated.user.userId).toBe(userId);

    // Reusar o token antigo (já rotacionado) falha...
    await expect(rotateRefreshToken(first.token)).rejects.toThrow();

    // ...e revoga em cascata o token novo também (proteção contra roubo/reuso de token).
    await expect(rotateRefreshToken(rotated.token)).rejects.toThrow();
  });

  it('revokeRefreshToken is idempotent and disables future rotation', async () => {
    const session = await createSession(userId);

    await revokeRefreshToken(session.token);
    await revokeRefreshToken(session.token); // idempotente, não deve lançar

    await expect(rotateRefreshToken(session.token)).rejects.toThrow();
  });
});
