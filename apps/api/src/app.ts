import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { errorHandler } from './core/_errors';
import { corsPlugin } from './core/plugins/cors.plugin';
import { healthPlugin } from './modules/health/health.plugin';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // ── Security ──────────────────────────────────────────────────
  app.register(corsPlugin);

  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'GeekStore API',
        version: '0.0.0',
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

  return app;
}
