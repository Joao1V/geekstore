import {
  couponBodySchema,
  couponListQuerySchema,
  couponListResponseSchema,
  couponParamsSchema,
  couponResponseSchema,
  couponUpdateBodySchema,
  priceBulkBodySchema,
  priceBulkResponseSchema,
  priceListQuerySchema,
  priceListResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  bulkSetPricesController,
  createCouponController,
  deleteCouponController,
  listCouponsController,
  listPricesController,
  updateCouponController,
} from './pricing.controller';

const tags = ['Preços'];

export async function pricingRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/prices',
    {
      onRequest: requirePermission('pricing:read'),
      schema: {
        tags,
        summary: 'Preço vigente do SKU em cada canal (na F1, só o site)',
        querystring: priceListQuerySchema,
        response: { 200: priceListResponseSchema },
      },
    },
    listPricesController
  );
  app.patch(
    '/prices',
    {
      onRequest: requirePermission('pricing:write'),
      schema: {
        tags,
        summary: 'Edição em lote do preço do site (novo registro de vigência por SKU alterado)',
        body: priceBulkBodySchema,
        response: { 200: priceBulkResponseSchema },
      },
    },
    bulkSetPricesController
  );

  app.get(
    '/coupons',
    {
      onRequest: requirePermission('pricing:read'),
      schema: {
        tags,
        summary: 'Lista cupons (busca por código; filtro por situação derivada)',
        querystring: couponListQuerySchema,
        response: { 200: couponListResponseSchema },
      },
    },
    listCouponsController
  );
  app.post(
    '/coupons',
    {
      onRequest: requirePermission('pricing:write'),
      schema: {
        tags,
        summary: 'Cria cupom (percentual, valor fixo ou frete grátis)',
        body: couponBodySchema,
        response: { 201: couponResponseSchema },
      },
    },
    createCouponController
  );
  app.patch(
    '/coupons/:coupon_id',
    {
      onRequest: requirePermission('pricing:write'),
      schema: {
        tags,
        summary: 'Edita cupom (o código de um cupom já usado não muda)',
        params: couponParamsSchema,
        body: couponUpdateBodySchema,
        response: { 200: couponResponseSchema },
      },
    },
    updateCouponController
  );
  app.delete(
    '/coupons/:coupon_id',
    {
      onRequest: requirePermission('pricing:write'),
      schema: {
        tags,
        summary: 'Apaga cupom nunca usado (o já usado só se desativa) (204)',
        params: couponParamsSchema,
      },
    },
    deleteCouponController
  );
}
