import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { envConfig } from '../config';

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  const { ORIGINS } = envConfig.cors;

  await fastify.register(cors, {
    // Sem CORS_ORIGINS configurada (dev local), libera geral — em produção sempre configurar a
    // lista real de origens permitidas. Com credentials:true isso é obrigatório em produção:
    // origin:true + credentials permite qualquer site ler respostas autenticadas via cookie.
    origin: ORIGINS.length > 0 ? ORIGINS : true,
    credentials: true,
  });
});
