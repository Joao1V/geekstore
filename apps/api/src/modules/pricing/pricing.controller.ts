import type { PriceBulkBody } from '@geekstore/shared';
import type { FastifyRequest } from 'fastify';

import { bulkSetSitePrices, listCurrentPrices } from './pricing.service';

export async function listPricesController(
  request: FastifyRequest<{ Querystring: { sku_id: string } }>
) {
  return { data: await listCurrentPrices(request.query.sku_id) };
}

export async function bulkSetPricesController(request: FastifyRequest<{ Body: PriceBulkBody }>) {
  return { data: { updated: await bulkSetSitePrices(request.user.sub, request.body) } };
}
