import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { envConfig } from '../config';

export const cookiePlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(cookie, {
    secret: envConfig.cookie.SECRET,
  });
});
