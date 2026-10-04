import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { CheckoutBody, OrderListQuery } from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { NotFoundError } from '../../core/_errors';
import { envConfig } from '../../core/config';
import { optionalCustomerId, requireCustomerId } from '../customers/customer-token';
import { paymentProvider } from '../payments/payment-provider';
import { applyPaymentEvent } from '../payments/webhook.service';
import { checkCoupon } from './coupon.service';
import { listCustomerOrders } from './customer-orders.service';
import { createOrder, getCustomerOrder, getOrderById } from './order.service';

export async function checkoutController(
  request: FastifyRequest<{ Body: CheckoutBody; Headers: { 'idempotency-key': string } }>,
  reply: FastifyReply
) {
  const order = await createOrder({
    customerId: optionalCustomerId(request),
    idempotencyKey: request.headers['idempotency-key'],
    body: request.body,
  });
  return reply.status(201).send({ data: order });
}

export async function orderByIdController(
  request: FastifyRequest<{ Params: { order_id: string } }>
) {
  return { data: await getOrderById(request.params.order_id) };
}

/** Só fora de produção: no lugar do aviso do gateway, "paga" o Pix/boleto de teste. */
export async function simulatePaymentController(
  request: FastifyRequest<{ Params: { order_id: string } }>
) {
  if (envConfig.server.NODE_ENV === 'production') throw new NotFoundError('Rota não encontrada.');
  const payment = await prisma.payment.findFirst({
    where: { order_id: request.params.order_id },
    orderBy: { created_at: 'desc' },
  });
  if (!payment) throw new NotFoundError('Pedido não encontrado.');
  await applyPaymentEvent({
    provider: paymentProvider.name,
    eventId: `sim-${randomUUID()}`,
    externalId: payment.external_id,
    state: 'approved',
  });
  return { data: await getOrderById(request.params.order_id) };
}

export async function couponCheckController(
  request: FastifyRequest<{ Body: { code: string; subtotal_cents: number } }>
) {
  return { data: await checkCoupon(prisma, request.body.code, request.body.subtotal_cents) };
}

export async function customerOrdersController(
  request: FastifyRequest<{ Querystring: OrderListQuery }>
) {
  return listCustomerOrders(requireCustomerId(request), request.query);
}

export async function customerOrderController(
  request: FastifyRequest<{ Params: { number: number } }>
) {
  return { data: await getCustomerOrder(requireCustomerId(request), request.params.number) };
}

export async function mockWebhookController(
  request: FastifyRequest<{
    Body: { event_id: string; payment_id: string; state: 'approved' | 'declined' | 'expired' };
  }>
) {
  const result = await applyPaymentEvent({
    provider: 'mock',
    eventId: request.body.event_id,
    externalId: request.body.payment_id,
    state: request.body.state,
  });
  return { data: result };
}
