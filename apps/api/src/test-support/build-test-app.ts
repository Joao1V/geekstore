import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { errorHandler, notFoundHandler } from '../core/_errors';
import { cookiePlugin } from '../core/plugins/cookie.plugin';
import { jwtPlugin } from '../core/plugins/jwt.plugin';
import { auditRoutes } from '../modules/audit/audit.routes';
import { catalogRoutes } from '../modules/catalog/catalog.routes';
import {
  contentRoutes,
  storeBannerRoutes,
  storePageRoutes,
} from '../modules/content/content.routes';
import { customerRoutes } from '../modules/customers/customer.routes';
import { adminOrderRoutes } from '../modules/orders/admin-orders.routes';
import {
  customerOrderRoutes,
  storeOrderRoutes,
  webhookRoutes,
} from '../modules/orders/order.routes';
import { pricingRoutes } from '../modules/pricing/pricing.routes';
import { purchasingRoutes } from '../modules/purchasing/receipt.routes';
import { shippingRoutes } from '../modules/shipping/shipping.routes';
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

  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(catalogRoutes, { prefix: '/api/catalog' });
  await app.register(stockRoutes, { prefix: '/api/stock' });
  await app.register(purchasingRoutes, { prefix: '/api/purchasing' });
  await app.register(customerRoutes, { prefix: '/api/customer' });
  await app.register(shippingRoutes, { prefix: '/api/store/shipping' });
  await app.register(storeOrderRoutes, { prefix: '/api/store' });
  await app.register(customerOrderRoutes, { prefix: '/api/customer/orders' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.register(adminOrderRoutes, { prefix: '/api/orders' });
  await app.register(pricingRoutes, { prefix: '/api/pricing' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(storefrontRoutes, { prefix: '/api/store' });
  await app.register(storePageRoutes, { prefix: '/api/store/pages' });
  await app.register(storeBannerRoutes, { prefix: '/api/store/banners' });
  await app.register(contentRoutes, { prefix: '/api/content' });
  await app.register(auditRoutes, { prefix: '/api/audit-logs' });
  await app.ready();
  return app;
}
