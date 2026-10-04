import {
  cartCheckBodySchema,
  cartCheckResponseSchema,
  checkoutBodySchema,
  checkoutHeadersSchema,
  couponCheckBodySchema,
  couponCheckResponseSchema,
  orderListQuerySchema,
  orderListResponseSchema,
  orderParamsSchema,
  orderResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  checkoutController,
  couponCheckController,
  customerOrderController,
  customerOrdersController,
  mockWebhookController,
  orderByIdController,
  simulatePaymentController,
} from './order.controller';
import { checkCart } from './order.service';

const tags = ['Pedidos'];
const CHECKOUT_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };
const orderIdParams = z.object({ order_id: z.string().uuid() });

/** Checkout e consulta do pedido pela loja (compra com ou sem conta). Prefixo: /api/store. */
export async function storeOrderRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.post(
    '/checkout',
    {
      config: { rateLimit: CHECKOUT_RATE_LIMIT },
      schema: {
        tags,
        summary:
          'Cria o pedido (reserva o estoque e inicia o pagamento). Header Idempotency-Key obrigatório.',
        headers: checkoutHeadersSchema,
        body: checkoutBodySchema,
        response: { 201: orderResponseSchema },
      },
    },
    checkoutController
  );
  app.post(
    '/cart/check',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags,
        summary: 'Confere os itens do carrinho: à venda, preço atual e quantidade disponível',
        body: cartCheckBodySchema,
        response: { 200: cartCheckResponseSchema },
      },
    },
    async (request) => ({ data: await checkCart(request.body.items) })
  );
  app.get(
    '/orders/:order_id',
    {
      schema: {
        tags,
        summary: 'Pedido pelo identificador (quem comprou sem conta guarda o link)',
        params: orderIdParams,
        response: { 200: orderResponseSchema },
      },
    },
    orderByIdController
  );
  app.post(
    '/orders/:order_id/simulate-payment',
    {
      schema: {
        tags,
        summary: 'Só fora de produção: simula o aviso de pagamento aprovado do Pix/boleto',
        params: orderIdParams,
        response: { 200: orderResponseSchema },
      },
    },
    simulatePaymentController
  );
  app.post(
    '/coupons/check',
    {
      config: { rateLimit: CHECKOUT_RATE_LIMIT },
      schema: {
        tags,
        summary: 'Confere um cupom e calcula o desconto para o subtotal',
        body: couponCheckBodySchema,
        response: { 200: couponCheckResponseSchema },
      },
    },
    couponCheckController
  );
}

/** Histórico do cliente logado. Prefixo: /api/customer/orders. */
export async function customerOrderRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.get(
    '/',
    {
      schema: {
        tags,
        summary: 'Meus pedidos',
        querystring: orderListQuerySchema,
        response: { 200: orderListResponseSchema },
      },
    },
    customerOrdersController
  );
  app.get(
    '/:number',
    {
      schema: {
        tags,
        summary: 'Um pedido meu, pelo número',
        params: orderParamsSchema,
        response: { 200: orderResponseSchema },
      },
    },
    customerOrderController
  );
}

const webhookBody = z.object({
  event_id: z.string().min(1).max(100),
  payment_id: z.string().min(1).max(100),
  state: z.enum(['approved', 'declined', 'expired']),
});

/** Avisos de pagamento do provedor simulado. Prefixo: /api/webhooks. */
export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/mock-payments',
    {
      schema: {
        tags,
        summary: 'Aviso de pagamento do provedor simulado (idempotente pelo event_id)',
        body: webhookBody,
      },
    },
    mockWebhookController
  );
}
