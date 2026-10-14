import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { CheckoutBody, CouponCheckBody, OrderListQuery } from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { BadRequestError, NotFoundError } from '../../core/_errors';
import { envConfig } from '../../core/config';
import { optionalCustomerId, requireCustomerId } from '../customers/customer-token';
import { handleMercadoPagoNotification } from '../payments/mercado-pago-webhook';
import { applyPaymentEvent } from '../payments/webhook.service';
import { loadCartSkus } from './cart-lines';
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
  // Pagamento de verdade (Mercado Pago) só se aprova pelo aviso do provedor, nunca por aqui.
  if (payment.provider !== 'mock') throw new NotFoundError('Rota não encontrada.');
  await applyPaymentEvent({
    provider: payment.provider,
    eventId: `sim-${randomUUID()}`,
    externalId: payment.external_id,
    state: 'approved',
  });
  return { data: await getOrderById(request.params.order_id) };
}

export async function couponCheckController(request: FastifyRequest<{ Body: CouponCheckBody }>) {
  const skus = await loadCartSkus(request.body.items.map((line) => line.sku_id));
  const lines = request.body.items.map((line) => {
    const sku = skus.get(line.sku_id);
    if (!sku) throw new BadRequestError('Algum item do carrinho não está mais à venda.');
    return { category_id: sku.category_id, total_cents: sku.price_cents * line.quantity };
  });
  return { data: await checkCoupon(prisma, request.body.code, lines) };
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

export async function mercadoPagoWebhookController(
  request: FastifyRequest<{ Querystring: { 'data.id'?: string }; Body: unknown }>
) {
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const result = await handleMercadoPagoNotification({
    signatureHeader: header('x-signature'),
    requestId: header('x-request-id'),
    queryDataId: request.query['data.id'],
    body: (request.body ?? undefined) as Parameters<
      typeof handleMercadoPagoNotification
    >[0]['body'],
  });
  return { data: result };
}
