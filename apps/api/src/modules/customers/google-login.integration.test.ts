import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { googleKeys } from '../../core/security/google-id-token';
import { hashPassword } from '../../core/security/password';
import { loginCustomerWithGoogle } from './customer-auth.service';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const KID = 'test-key';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

type Claims = Record<string, unknown>;

/** ID token assinado com a chave de teste, no formato que o Google entrega. */
function idToken(claims: Claims, key = privateKey): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${part({ alg: 'RS256', kid: KID })}.${part({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 600,
    email_verified: true,
    ...claims,
  })}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
}

describe('login com Google do cliente (integration — requires a live DATABASE_URL)', () => {
  const newCustomerEmail = `google-new-${randomUUID()}@geekstore.local`;
  const oldCustomerEmail = `google-old-${randomUUID()}@geekstore.local`;
  const subs = {
    admin: `sub-${randomUUID()}`,
    fresh: `sub-${randomUUID()}`,
    old: `sub-${randomUUID()}`,
  };

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    vi.spyOn(googleKeys, 'load').mockResolvedValue([
      { ...publicKey.export({ format: 'jwk' }), kid: KID },
    ]);
    await prisma.customer.create({
      data: {
        email: oldCustomerEmail,
        name: 'Cliente Antigo',
        password_hash: await hashPassword('senha-teste-123'),
      },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    await prisma.customer.deleteMany({
      where: { email: { in: [newCustomerEmail, oldCustomerEmail] } },
    });
    await prisma.$disconnect();
  });

  it('rejects wrong audience, expired, unverified e-mail and forged signature', async () => {
    const base = { sub: subs.old, email: oldCustomerEmail };
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await expect(loginCustomerWithGoogle(idToken({ ...base, aud: 'outro-app' }))).rejects.toThrow();
    await expect(
      loginCustomerWithGoogle(idToken({ ...base, exp: Math.floor(Date.now() / 1000) - 3600 }))
    ).rejects.toThrow();
    await expect(
      loginCustomerWithGoogle(idToken({ ...base, email_verified: false }))
    ).rejects.toThrow();
    await expect(loginCustomerWithGoogle(idToken(base, other))).rejects.toThrow();
  });

  it('creates a customer on the first Google login and reuses it after', async () => {
    const claims = { sub: subs.fresh, email: newCustomerEmail, name: 'Nova Pessoa' };
    const first = await loginCustomerWithGoogle(idToken(claims));
    const second = await loginCustomerWithGoogle(idToken(claims));
    expect(first.email).toBe(newCustomerEmail);
    expect(first.name).toBe('Nova Pessoa');
    expect(second.customer_id).toBe(first.customer_id);
  });

  it('links a Google login to the customer that already has that e-mail', async () => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { email: oldCustomerEmail } });
    const customer = await loginCustomerWithGoogle(
      idToken({ sub: subs.old, email: oldCustomerEmail })
    );
    expect(customer.customer_id).toBe(before.customer_id);
    const after = await prisma.customer.findUniqueOrThrow({ where: { email: oldCustomerEmail } });
    expect(after.google_sub).toBe(subs.old);
    expect(after.password_hash).toBe(before.password_hash);
  });
});
