import type { FastifyReply, FastifyRequest } from 'fastify';

export async function getHealthHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.send({ status: 'ok' });
}
