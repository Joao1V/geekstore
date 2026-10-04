import type { FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../../core/_errors';

/** Audiência do JWT do cliente: o token da loja não vale no admin e o do admin não vale na conta. */
export const CUSTOMER_AUDIENCE = 'customer';

type CustomerTokenPayload = { sub: string; aud?: string };

function readBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function verify(request: FastifyRequest, token: string): string | null {
  try {
    const payload = request.server.jwt.verify<CustomerTokenPayload>(token);
    return payload.aud === CUSTOMER_AUDIENCE ? payload.sub : null;
  } catch {
    return null;
  }
}

/** O cliente logado, ou erro 401. Use nas rotas da conta (endereços, pedidos, perfil). */
export function requireCustomerId(request: FastifyRequest): string {
  const token = readBearer(request);
  const customerId = token ? verify(request, token) : null;
  if (!customerId) throw new UnauthorizedError('Entre na sua conta para continuar.');
  return customerId;
}

/** O cliente logado, ou `null` (compra como visitante). Token inválido conta como visitante. */
export function optionalCustomerId(request: FastifyRequest): string | null {
  const token = readBearer(request);
  return token ? verify(request, token) : null;
}

export function signCustomerToken(request: FastifyRequest, customerId: string): string {
  // O tipo do payload do @fastify/jwt é o do admin; o do cliente tem `aud` no lugar de `role`.
  return request.server.jwt.sign({ sub: customerId, aud: CUSTOMER_AUDIENCE } as never);
}
