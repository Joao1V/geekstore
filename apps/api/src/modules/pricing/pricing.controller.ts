import type {
  CouponBody,
  CouponListQuery,
  CouponParams,
  CouponUpdateBody,
  PriceBulkBody,
} from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from './coupon.service';
import { bulkSetSitePrices, listCurrentPrices } from './pricing.service';

export async function listPricesController(
  request: FastifyRequest<{ Querystring: { sku_id: string } }>
) {
  return { data: await listCurrentPrices(request.query.sku_id) };
}

export async function bulkSetPricesController(request: FastifyRequest<{ Body: PriceBulkBody }>) {
  return { data: { updated: await bulkSetSitePrices(request.user.sub, request.body) } };
}

export async function listCouponsController(
  request: FastifyRequest<{ Querystring: CouponListQuery }>
) {
  return listCoupons(request.query);
}

export async function createCouponController(
  request: FastifyRequest<{ Body: CouponBody }>,
  reply: FastifyReply
) {
  const data = await createCoupon(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateCouponController(
  request: FastifyRequest<{ Params: CouponParams; Body: CouponUpdateBody }>
) {
  return { data: await updateCoupon(request.user.sub, request.params.coupon_id, request.body) };
}

export async function deleteCouponController(
  request: FastifyRequest<{ Params: CouponParams }>,
  reply: FastifyReply
) {
  await deleteCoupon(request.user.sub, request.params.coupon_id);
  return reply.status(204).send();
}
