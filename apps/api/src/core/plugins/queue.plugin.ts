import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue, type QueueOptions } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import IORedis from 'ioredis';

import { errorHandler } from '../_errors';
import { envConfig } from '../config';
import { requirePermission } from '../hooks';

const DEFAULT_JOB_ATTEMPTS = 5;
const BACKOFF_DELAY_MS = 5_000;
const COMPLETED_JOB_TTL_SECONDS = 60 * 60 * 24;
const FAILED_JOB_TTL_SECONDS = 60 * 60 * 24 * 7;

declare module 'fastify' {
  interface FastifyInstance {
    /** Conexão Redis compartilhada — reaproveite pra Queue; um Worker deve chamar `.duplicate()`. */
    redisConnection: IORedis;
    /**
     * Cria (e registra no painel `/admin/queues`) uma fila com retentativa e backoff padrão
     * (RF-PLA-02). O módulo dono da fila ainda cria seu próprio `Worker` separadamente.
     */
    createQueue: (name: string, options?: QueueOptions) => Queue;
  }
}

export const queuePlugin = fp(async (fastify: FastifyInstance) => {
  const connection = new IORedis(envConfig.redis.URL, { maxRetriesPerRequest: null });

  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const board = createBullBoard({ queues: [], serverAdapter });

  // Painel operacional: só perfis com `queues:read` (Bearer). O escopo encapsulado garante que o
  // hook vale para o painel inteiro (UI e API do bull-board) e para nenhuma outra rota. O
  // bull-board instala o próprio error handler (devolve 500), então o erro do hook é formatado
  // aqui com o handler da API para sair 401/403 no contrato padrão.
  await fastify.register(async (scope) => {
    scope.addHook('onRequest', async (request, reply) => {
      try {
        for (const hook of requirePermission('queues:read')) await hook(request);
      } catch (error) {
        return errorHandler.call(scope, error as Error, request, reply);
      }
    });
    await scope.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });
  });

  fastify.decorate('redisConnection', connection);
  fastify.decorate('createQueue', (name: string, options?: QueueOptions) => {
    const queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: DEFAULT_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_DELAY_MS },
        removeOnComplete: { age: COMPLETED_JOB_TTL_SECONDS },
        // Falhas ficam uma semana no painel de falhas antes de expirar — tempo de investigar.
        removeOnFail: { age: FAILED_JOB_TTL_SECONDS },
      },
      ...options,
    });
    board.addQueue(new BullMQAdapter(queue));
    return queue;
  });

  fastify.addHook('onClose', async () => {
    await connection.quit();
  });
});
