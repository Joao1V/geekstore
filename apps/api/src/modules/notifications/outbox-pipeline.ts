import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

import { type PublishedEvent, publishPendingEvents } from '../../core/outbox/outbox';
import { getEmailSender } from './email-sender';
import { handleOutboxEvent } from './notification.service';

const QUEUE_NAME = 'domain-events';
const PUBLISH_EVERY_MS = 2_000;
const WORKER_CONCURRENCY = 5;

/**
 * Liga o outbox à fila (D12): um publicador lê os eventos pendentes e os põe no BullMQ; um worker os
 * processa com retentativa e backoff (RF-PLA-02). Se o Redis estiver fora, o publicador falha, o
 * evento segue pendente e é tentado de novo com recuo; nada se perde.
 */
export function startOutboxPipeline(app: FastifyInstance): void {
  const queue = app.createQueue(QUEUE_NAME);
  const sender = getEmailSender();

  const worker = new Worker<PublishedEvent>(
    QUEUE_NAME,
    (job) => handleOutboxEvent(job.data, sender),
    { connection: app.redisConnection.duplicate(), concurrency: WORKER_CONCURRENCY }
  );
  worker.on('failed', (job, error) =>
    app.log.error({ err: error, event: job?.data.type }, 'falha ao processar evento')
  );

  const timer = setInterval(() => {
    publishPendingEvents(async (event) => {
      await queue.add(event.type, event);
    }).catch((error: unknown) => app.log.error(error, 'falha ao publicar eventos do outbox'));
  }, PUBLISH_EVERY_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
    await worker.close();
  });
}
