import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { PublishedEvent } from '../../core/outbox/outbox';
import { buildTestApp } from '../../test-support/build-test-app';
import type { EmailSender } from '../notifications/email-sender';
import { handleOutboxEvent } from '../notifications/notification.service';

describe('password recovery (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  const run = randomUUID().slice(0, 8);
  const email = `reset-${run}@exemplo.com`;
  const OLD = 'senha-antiga-123';
  const NEW = 'senha-nova-456';
  let customerId: string;

  const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload });
  const login = (password: string) => post('/api/customer/auth/login', { email, password });

  /** Pede o link, "entrega" o e-mail pelo consumidor e devolve o token que estava no link. */
  const requestLink = async (): Promise<string> => {
    expect((await post('/api/customer/auth/forgot-password', { email })).statusCode).toBe(200);
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { type: 'customer.password_reset_requested', entity_id: customerId },
      orderBy: { created_at: 'desc' },
    });
    const send = vi.fn().mockResolvedValue({ id: 'm1' });
    const sender: EmailSender = { name: 'fake', send };
    await handleOutboxEvent(
      { ...event, payload: event.payload as PublishedEvent['payload'] },
      sender
    );
    expect(send).toHaveBeenCalledTimes(1);
    const text = String(send.mock.calls[0]?.[0].text);
    expect(send.mock.calls[0]?.[0].to).toBe(email);
    const token = /token=([^\s&]+)/.exec(text)?.[1];
    if (!token) throw new Error('sem token no e-mail');
    return token;
  };

  beforeAll(async () => {
    app = await buildTestApp();
    expect(
      (
        await post('/api/customer/auth/register', {
          name: 'Maria Reset',
          email,
          password: OLD,
        })
      ).statusCode
    ).toBe(201);
    customerId = (await prisma.customer.findUniqueOrThrow({ where: { email } })).customer_id;
  });

  afterAll(async () => {
    const events = await prisma.outboxEvent.findMany({
      where: { entity_id: customerId },
      select: { outbox_event_id: true },
    });
    const ids = events.map((e) => e.outbox_event_id);
    await prisma.emailMessage.deleteMany({ where: { outbox_event_id: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { outbox_event_id: { in: ids } } });
    await prisma.customer.deleteMany({ where: { email } });
    await app.close();
    await prisma.$disconnect();
  });

  it('answers the same for an unknown e-mail and creates nothing', async () => {
    const before = await prisma.passwordReset.count();
    const response = await post('/api/customer/auth/forgot-password', {
      email: `ninguem-${run}@exemplo.com`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { ok: true } });
    expect(await prisma.passwordReset.count()).toBe(before);
  });

  it('emails a link that sets a new password once and closes the other sessions', async () => {
    const session = await login(OLD);
    expect(session.statusCode).toBe(200);
    expect(
      await prisma.customerRefreshToken.count({
        where: { customer_id: customerId, revoked_at: null },
      })
    ).toBeGreaterThan(0);

    const token = await requestLink();
    const done = await post('/api/customer/auth/reset-password', { token, password: NEW });
    expect(done.statusCode).toBe(200);

    expect((await login(OLD)).statusCode).toBe(401);
    expect((await login(NEW)).statusCode).toBe(200);
    // Todas as sessões antigas foram encerradas (a nova, do login acima, não conta).
    expect(
      await prisma.customerRefreshToken.count({
        where: {
          customer_id: customerId,
          revoked_at: null,
          created_at: { lt: new Date(Date.now() - 1) },
        },
      })
    ).toBeLessThanOrEqual(1);

    // O link vale uma vez.
    const again = await post('/api/customer/auth/reset-password', {
      token,
      password: 'outra-senha-789',
    });
    expect(again.statusCode).toBe(400);
    expect((await login(NEW)).statusCode).toBe(200);
  });

  it('refuses tampered, expired and malformed links', async () => {
    const token = await requestLink();
    const [id = '', sig = ''] = token.split('.');
    const body = (t: string) => ({ token: t, password: 'qualquer-senha-123' });

    expect(
      (await post('/api/customer/auth/reset-password', body(`${id}.${sig.slice(0, -2)}xx`)))
        .statusCode
    ).toBe(400);
    expect(
      (await post('/api/customer/auth/reset-password', body(`${randomUUID()}.${sig}`))).statusCode
    ).toBe(400);
    expect(
      (await post('/api/customer/auth/reset-password', body('sem-ponto-nenhum-no-token-aqui')))
        .statusCode
    ).toBe(400);

    await prisma.passwordReset.update({
      where: { password_reset_id: id },
      data: { expires_at: new Date(Date.now() - 1_000) },
    });
    expect((await post('/api/customer/auth/reset-password', body(token))).statusCode).toBe(400);
    // Nada disso trocou a senha.
    expect((await login(NEW)).statusCode).toBe(200);
  });

  it('limits how many links one e-mail can ask for per hour', async () => {
    for (let i = 0; i < 5; i += 1) {
      await post('/api/customer/auth/forgot-password', { email });
    }
    const recent = await prisma.passwordReset.count({
      where: { customer_id: customerId, created_at: { gt: new Date(Date.now() - 60 * 60_000) } },
    });
    expect(recent).toBeLessThanOrEqual(3);
  });
});
