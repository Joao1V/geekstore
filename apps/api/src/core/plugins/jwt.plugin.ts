import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { envConfig } from '../config';

export const jwtPlugin = fp(async (fastify: FastifyInstance) => {
  const { ACCESS_SECRET, ACCESS_EXPIRES_IN } = envConfig.jwt;

  await fastify.register(jwt, {
    secret: ACCESS_SECRET,
    sign: { expiresIn: ACCESS_EXPIRES_IN },
  });
});
