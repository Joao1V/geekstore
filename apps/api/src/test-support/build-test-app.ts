import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { errorHandler, notFoundHandler } from '../core/_errors';
import { jwtPlugin } from '../core/plugins/jwt.plugin';
import { auditRoutes } from '../modules/audit/audit.routes';
import { catalogRoutes } from '../modules/catalog/catalog.routes';
import { pricingRoutes } from '../modules/pricing/pricing.routes';
import { stockRoutes } from '../modules/stock/stock.routes';
import { storefrontRoutes } from '../modules/storefront/storefront.routes';
import { usersRoutes } from '../modules/users/users.routes';

/**
 * App mínimo para testes HTTP de RBAC: os mesmos módulos e o mesmo error handler do `buildApp`,
 * sem Redis/fila (o CI de integração só tem PostgreSQL).
 */
export async function buildTestApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(jwtPlugin);
  await app.register(catalogRoutes, { prefix: '/api/catalog' });
  await app.register(stockRoutes, { prefix: '/api/stock' });
  await app.register(pricingRoutes, { prefix: '/api/pricing' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(storefrontRoutes, { prefix: '/api/store' });
  await app.register(auditRoutes, { prefix: '/api/audit-logs' });
  await app.ready();
  return app;
}
