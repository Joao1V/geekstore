import rateLimit from '@fastify/rate-limit';
import { apiErrorBodySchema } from '@geekstore/shared';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler, notFoundHandler } from './global-error-handler';
import { NotFoundError } from './not-found-error';

async function buildTestApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  await app.register(rateLimit, { global: false });

  app.get('/domain-error', async () => {
    throw new NotFoundError('SKU não encontrado.');
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/validated',
      { schema: { body: z.object({ email: z.string().email() }) } },
      async () => ({ ok: true })
    );
  app.get('/limited', { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } }, async () => ({
    ok: true,
  }));
  return app;
}

describe('error responses follow the API error contract', () => {
  it('domain errors: status, stable code and request_id', async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/domain-error' });

    expect(response.statusCode).toBe(404);
    const body = apiErrorBodySchema.parse(response.json());
    expect(body).toMatchObject({
      error: 'Not Found',
      code: 'not_found',
      message: 'SKU não encontrado.',
    });
    expect(body.request_id).toBeTruthy();
  });

  it('validation errors: validation_failed with details keyed by field', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/validated',
      payload: { email: 'x' },
    });

    expect(response.statusCode).toBe(400);
    const body = apiErrorBodySchema.parse(response.json());
    expect(body.code).toBe('validation_failed');
    expect(Object.keys(body.details as object)).toEqual(['email']);
  });

  it('unknown routes use the same contract (not the Fastify default)', async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/nao-existe' });

    expect(response.statusCode).toBe(404);
    expect(apiErrorBodySchema.parse(response.json()).code).toBe('not_found');
  });

  it('rate limit: 429 with rate_limited and the HTTP status text', async () => {
    const app = await buildTestApp();
    await app.inject({ method: 'GET', url: '/limited' });
    const response = await app.inject({ method: 'GET', url: '/limited' });

    expect(response.statusCode).toBe(429);
    const body = apiErrorBodySchema.parse(response.json());
    expect(body).toMatchObject({ error: 'Too Many Requests', code: 'rate_limited' });
  });
});
