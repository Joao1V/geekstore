import {
  adminOrderListQuerySchema,
  adminOrderListResponseSchema,
  orderCancelBodySchema,
  orderDashboardResponseSchema,
  orderParamsSchema,
  orderResponseSchema,
  orderShipBodySchema,
  refundBodySchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  cancelAdminOrder,
  getAdminOrder,
  getOrderDashboard,
  listAdminOrders,
  markDelivered,
  shipOrder,
  startPicking,
} from './admin-orders.service';
import { refundOrder } from './refund.service';

const tags = ['Pedidos (admin)'];
const read = { onRequest: requirePermission('orders:read') };
const write = { onRequest: requirePermission('orders:write') };

/** Pedidos no painel. Prefixo: /api/orders. */
export async function adminOrderRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista os pedidos (filtro por estado e busca por número, cliente ou SKU)',
        querystring: adminOrderListQuerySchema,
        response: { 200: adminOrderListResponseSchema },
      },
    },
    async (request) => listAdminOrders(request.query)
  );
  app.get(
    '/summary',
    {
      ...read,
      schema: {
        tags,
        summary: 'Números do painel: vendas de hoje, pedidos por estado e os últimos 7 dias',
        response: { 200: orderDashboardResponseSchema },
      },
    },
    async () => ({ data: await getOrderDashboard() })
  );
  app.get(
    '/:number',
    {
      ...read,
      schema: {
        tags,
        summary: 'Detalhe do pedido',
        params: orderParamsSchema,
        response: { 200: orderResponseSchema },
      },
    },
    async (request) => ({ data: await getAdminOrder(request.params.number) })
  );
  app.post(
    '/:number/start-picking',
    {
      ...write,
      schema: {
        tags,
        summary: 'Manda o pedido pago para a separação',
        params: orderParamsSchema,
        response: { 200: orderResponseSchema },
      },
    },
    async (request) => ({ data: await startPicking(request.user.sub, request.params.number) })
  );
  app.post(
    '/:number/ship',
    {
      ...write,
      schema: {
        tags,
        summary: 'Envia o pedido: baixa o estoque de verdade e registra o rastreio',
        params: orderParamsSchema,
        body: orderShipBodySchema,
        response: { 200: orderResponseSchema },
      },
    },
    async (request) => ({
      data: await shipOrder(request.user.sub, request.params.number, request.body),
    })
  );
  app.post(
    '/:number/deliver',
    {
      ...write,
      schema: {
        tags,
        summary: 'Marca o pedido como entregue',
        params: orderParamsSchema,
        response: { 200: orderResponseSchema },
      },
    },
    async (request) => ({ data: await markDelivered(request.user.sub, request.params.number) })
  );
  app.post(
    '/:number/cancel',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cancela antes da expedição e devolve a reserva ao estoque',
        params: orderParamsSchema,
        body: orderCancelBodySchema,
        response: { 200: orderResponseSchema },
      },
    },
    async (request) => ({
      data: await cancelAdminOrder(request.user.sub, request.params.number, request.body),
    })
  );

  app.post(
    '/:number/refunds',
    {
      onRequest: requirePermission('orders:refund'),
      schema: {
        tags,
        summary:
          'Estorna dinheiro do pedido (total ou parcial). Não cancela o pedido nem repõe estoque',
        params: orderParamsSchema,
        body: refundBodySchema,
        response: { 200: orderResponseSchema },
      },
    },
    async (request) => ({
      data: await refundOrder(request.user.sub, request.params.number, request.body),
    })
  );
}
