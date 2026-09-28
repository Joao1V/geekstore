import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { getHealthHandler } from './health.handler';

describe('getHealthHandler', () => {
  it('replies with status ok', async () => {
    const send = vi.fn();
    const reply = { send } as unknown as FastifyReply;
    const request = {} as FastifyRequest;

    await getHealthHandler(request, reply);

    expect(send).toHaveBeenCalledWith({ status: 'ok' });
  });
});
