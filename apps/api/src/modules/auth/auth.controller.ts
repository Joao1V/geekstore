import type { AuthLoginBody, AuthSessionResponse } from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../../core/_errors';
import { envConfig } from '../../core/config';
import {
  createSession,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyCredentials,
} from './auth.service';

const REFRESH_COOKIE_NAME = 'geekstore_refresh_token';

function refreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: envConfig.server.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    expires: expiresAt,
    signed: true,
  };
}

function readRefreshCookie(request: FastifyRequest): string {
  const raw = request.cookies[REFRESH_COOKIE_NAME];
  if (!raw) throw new UnauthorizedError('Sessão inválida.');

  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) throw new UnauthorizedError('Sessão inválida.');

  return unsigned.value;
}

export async function loginController(
  request: FastifyRequest<{ Body: AuthLoginBody }>,
  reply: FastifyReply
): Promise<void> {
  const { email, password } = request.body;
  const user = await verifyCredentials(email, password);
  const { token: refreshToken, expiresAt } = await createSession(user.user_id);
  const accessToken = await request.server.jwt.sign({ sub: user.user_id });

  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(expiresAt));

  const body: AuthSessionResponse = { data: { access_token: accessToken, user } };
  reply.send(body);
}

export async function refreshController(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const rawToken = readRefreshCookie(request);
  const { token: refreshToken, expiresAt, user } = await rotateRefreshToken(rawToken);
  const accessToken = await request.server.jwt.sign({ sub: user.user_id });

  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(expiresAt));

  const body: AuthSessionResponse = { data: { access_token: accessToken, user } };
  reply.send(body);
}

export async function logoutController(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const raw = request.cookies[REFRESH_COOKIE_NAME];
  if (raw) {
    const unsigned = request.unsignCookie(raw);
    if (unsigned.valid && unsigned.value) {
      await revokeRefreshToken(unsigned.value);
    }
  }

  reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  reply.status(204).send();
}
