import { createHash, randomBytes } from 'node:crypto';

const REFRESH_TOKEN_BYTES = 32;

export function generateOpaqueToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Duas abas (ou duas chamadas) renovando a sessão com o mesmo cookie ao mesmo tempo é normal, não roubo:
 * a segunda chega com o token que a primeira acabou de trocar. Dentro desta janela o token trocado
 * ainda renova; passou dela, reuso derruba todas as sessões da pessoa.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

export const isWithinReuseGrace = (revokedAt: Date, now: Date = new Date()): boolean =>
  now.getTime() - revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
