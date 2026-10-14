import { createHmac, timingSafeEqual } from 'node:crypto';

import { envConfig } from '../config';

/**
 * Token `<id>.<assinatura>` para links de e-mail (nova senha, confirmar newsletter, cancelar inscrição).
 * A assinatura é um HMAC do id com o segredo da API e um `purpose`, então um link de um tipo não vale
 * para outro e nenhum segredo precisa ser guardado: o servidor só confere a assinatura.
 */
function signature(purpose: string, id: string): string {
  return createHmac('sha256', envConfig.cookie.SECRET)
    .update(`${purpose}:${id}`)
    .digest('base64url');
}

export const signToken = (purpose: string, id: string): string => `${id}.${signature(purpose, id)}`;

/** O id do token, ou `null` se a assinatura não bate (adulterado, de outro tipo ou malformado). */
export function readToken(purpose: string, token: string): string | null {
  const [id, received] = token.split('.');
  if (!id || !received) return null;
  const expected = Buffer.from(signature(purpose, id));
  const actual = Buffer.from(received);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null;
}
