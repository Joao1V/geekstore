import { createPublicKey, type JsonWebKey, verify } from 'node:crypto';

import { ExternalApiError, UnauthorizedError } from '../_errors';
import { envConfig } from '../config';

/**
 * Valida o ID token que o botão "Entrar com Google" entrega ao navegador: assinatura RS256 contra as
 * chaves públicas do Google (JWKS), emissor, destinatário (nosso Client ID), validade e e-mail
 * confirmado. Sem biblioteca: só `node:crypto` e um `fetch` ao JWKS, em cache.
 */
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const JWKS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

export type GoogleIdentity = { sub: string; email: string; name: string };

type Jwk = JsonWebKey & { kid?: string };
type Jwks = { keys: Jwk[] };

let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null;

/** Trocável nos testes: substitui a leitura do JWKS por um conjunto fixo. */
export const googleKeys = {
  async load(forceRefresh: boolean): Promise<Jwk[]> {
    const now = Date.now();
    if (!forceRefresh && cachedKeys && now - cachedKeys.fetchedAt < JWKS_TTL_MS) {
      return cachedKeys.keys;
    }
    const response = await fetch(GOOGLE_JWKS_URL);
    if (!response.ok) throw new ExternalApiError('Não foi possível validar o login com o Google.');
    const jwks = (await response.json()) as Jwks;
    cachedKeys = { keys: jwks.keys, fetchedAt: now };
    return jwks.keys;
  },
};

export const isGoogleLoginEnabled = (): boolean => Boolean(envConfig.google.CLIENT_ID);

const invalid = () => new UnauthorizedError('Não foi possível entrar com o Google.');

function decodePart<T>(part: string | undefined): T {
  if (!part) throw invalid();
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
  } catch {
    throw invalid();
  }
}

async function findKey(kid: string | undefined): Promise<Jwk> {
  for (const forceRefresh of [false, true]) {
    const key = (await googleKeys.load(forceRefresh)).find((candidate) => candidate.kid === kid);
    if (key) return key;
  }
  throw invalid();
}

type Claims = {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdentity> {
  const clientId = envConfig.google.CLIENT_ID;
  if (!clientId) throw new UnauthorizedError('Entrar com o Google não está disponível.');

  const [headerPart, payloadPart, signaturePart] = credential.split('.');
  const header = decodePart<{ alg?: string; kid?: string }>(headerPart);
  if (header.alg !== 'RS256' || !payloadPart || !signaturePart) throw invalid();

  const jwk = await findKey(header.kid);
  const isSignatureValid = verify(
    'RSA-SHA256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(signaturePart, 'base64url')
  );
  if (!isSignatureValid) throw invalid();

  const claims = decodePart<Claims>(payloadPart);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  if (
    !claims.iss ||
    !GOOGLE_ISSUERS.has(claims.iss) ||
    claims.aud !== clientId ||
    !claims.sub ||
    !claims.email ||
    !emailVerified ||
    typeof claims.exp !== 'number' ||
    claims.exp + CLOCK_SKEW_SECONDS < nowSeconds
  ) {
    throw invalid();
  }

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    name: claims.name?.trim() || claims.email.split('@')[0] || 'Cliente',
  };
}
