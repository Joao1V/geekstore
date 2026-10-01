import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { errorHandler, notFoundHandler } from './core/_errors';
import { envConfig } from './core/config';
import { cookiePlugin } from './core/plugins/cookie.plugin';
import { corsPlugin } from './core/plugins/cors.plugin';
import { jwtPlugin } from './core/plugins/jwt.plugin';
import { queuePlugin } from './core/plugins/queue.plugin';
import { rateLimitPlugin } from './core/plugins/rate-limit.plugin';
import { auditRoutes } from './modules/audit/audit.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { healthPlugin } from './modules/health/health.plugin';
import { pricingRoutes } from './modules/pricing/pricing.routes';
import { stockRoutes } from './modules/stock/stock.routes';
import { usersRoutes } from './modules/users/users.routes';

export function buildApp() {
  const { NODE_ENV, TRUST_PROXY_HOPS } = envConfig.server;

  const app = Fastify({
    // Confia só nos N saltos mais próximos (hop 0 = a conexão direta); 0 = sem proxy confiável.
    trustProxy: (_address, hop) => hop < TRUST_PROXY_HOPS,
    logger: {
      level: NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            }
          : undefined,
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // ── Security ──────────────────────────────────────────────────
  app.register(corsPlugin);
  app.register(cookiePlugin);
  app.register(rateLimitPlugin);
  app.register(jwtPlugin);
  app.register(queuePlugin);

  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'GeekStore API',
        version: '0.0.0',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  app.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
  });

  // ── Routes ────────────────────────────────────────────────────
  app.register(healthPlugin);
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(catalogRoutes, { prefix: '/api/catalog' });
  app.register(stockRoutes, { prefix: '/api/stock' });
  app.register(pricingRoutes, { prefix: '/api/pricing' });
  app.register(usersRoutes, { prefix: '/api/users' });
  app.register(auditRoutes, { prefix: '/api/audit-logs' });

  return app;
}
