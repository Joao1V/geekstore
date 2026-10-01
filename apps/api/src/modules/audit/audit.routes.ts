import { auditLogListQuerySchema, auditLogListResponseSchema } from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import { listAuditLogsController } from './audit.controller';

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      onRequest: requirePermission('audit:read'),
      schema: {
        tags: ['Auditoria'],
        summary: 'Log de auditoria (quem, quando, antes e depois), mais recentes primeiro',
        querystring: auditLogListQuerySchema,
        response: { 200: auditLogListResponseSchema },
      },
    },
    listAuditLogsController
  );
}
