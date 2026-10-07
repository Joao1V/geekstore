import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';
import { documentField, phoneField, shippingAddressSchema } from './customers';
import { cartLineSchema, shippingServiceCodeSchema } from './shipping';

export const paymentMethodSchema = z.enum(['pix', 'card', 'boleto']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const orderStatusSchema = z.enum(['open', 'completed', 'cancelled']);
export const paymentStatusSchema = z.enum([
  'pending',
  'approved',
  'partially_refunded',
  'refunded',
]);
export const fulfillmentStatusSchema = z.enum([
  'not_picked',
  'picking',
  'partially_shipped',
  'shipped',
  'delivered',
]);
export const paymentAttemptStatusSchema = z.enum(['pending', 'approved', 'declined', 'expired']);

/** Desconto de quem paga no Pix (a vitrine já anuncia 5%). */
export const PIX_DISCOUNT_PERCENT = 5;
export const MAX_INSTALLMENTS = 12;

// ── Checkout ───────────────────────────────────────────────────────────────────
// Nenhum dado de cartão chega à API (RNF-07): o navegador troca o cartão por um token do provedor
// (no simulado, `mock_tok_approved_1234` ou `mock_tok_declined_0002`) e só o token viaja.
export const checkoutBodySchema = z.object({
  items: z.array(cartLineSchema).min(1).max(100),
  contact: z.object({
    name: z.string().trim().min(2, 'Informe seu nome').max(255),
    email: z.string().trim().toLowerCase().email('E-mail inválido').max(255),
    phone: phoneField,
    document: documentField,
  }),
  shipping_service: shippingServiceCodeSchema,
  /** Obrigatório, exceto na retirada na loja. */
  shipping_address: shippingAddressSchema.optional(),
  coupon_code: z.string().trim().toUpperCase().min(1).max(40).optional(),
  payment: z.object({
    method: paymentMethodSchema,
    installments: z.number().int().min(1).max(MAX_INSTALLMENTS).default(1),
    card_token: z.string().trim().max(100).optional(),
  }),
});
export type CheckoutBody = z.infer<typeof checkoutBodySchema>;

export const checkoutHeadersSchema = z.object({
  'idempotency-key': z.string().trim().min(8).max(128),
});

// ── Pedido ─────────────────────────────────────────────────────────────────────
export const orderItemSchema = z.object({
  sku_id: z.string().uuid(),
  sku_code: z.string(),
  name: z.string(),
  variant: z.string().nullable(),
  image_url: z.string().nullable(),
  unit_price_cents: z.number().int(),
  quantity: z.number().int(),
  total_cents: z.number().int(),
});

export const orderPaymentSchema = z.object({
  method: paymentMethodSchema,
  status: paymentAttemptStatusSchema,
  installments: z.number().int(),
  amount_cents: z.number().int(),
  /** O que a tela mostra: código Pix, linha do boleto, final do cartão. */
  details: z.record(z.string(), z.unknown()).nullable(),
  expires_at: isoDateTimeSchema.nullable(),
});

export const orderShipmentSchema = z.object({
  carrier: z.string(),
  service: z.string(),
  tracking_code: z.string().nullable(),
  status: z.enum(['pending', 'shipped', 'delivered']),
  shipped_at: isoDateTimeSchema.nullable(),
  delivered_at: isoDateTimeSchema.nullable(),
});

/** O estado que o cliente vê (RF-PED-02): derivado dos três estados independentes do pedido. */
export const displayStatusSchema = z.enum([
  'awaiting_payment',
  'paid',
  'picking',
  'shipped',
  'delivered',
  'cancelled',
]);
export type DisplayStatus = z.infer<typeof displayStatusSchema>;

export function displayStatusOf(order: {
  status: z.infer<typeof orderStatusSchema>;
  payment_status: z.infer<typeof paymentStatusSchema>;
  fulfillment_status: z.infer<typeof fulfillmentStatusSchema>;
}): DisplayStatus {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.fulfillment_status === 'delivered') return 'delivered';
  if (order.fulfillment_status === 'shipped' || order.fulfillment_status === 'partially_shipped') {
    return 'shipped';
  }
  if (order.payment_status === 'pending') return 'awaiting_payment';
  return order.fulfillment_status === 'picking' ? 'picking' : 'paid';
}

export const displayStatusLabels: Record<DisplayStatus, string> = {
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  picking: 'Em separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const orderSchema = z.object({
  order_id: z.string().uuid(),
  number: z.number().int(),
  status: orderStatusSchema,
  payment_status: paymentStatusSchema,
  fulfillment_status: fulfillmentStatusSchema,
  display_status: displayStatusSchema,
  subtotal_cents: z.number().int(),
  shipping_cents: z.number().int(),
  discount_cents: z.number().int(),
  total_cents: z.number().int(),
  coupon_code: z.string().nullable(),
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    document: z.string().nullable(),
  }),
  shipping_service: z.string(),
  shipping_address: z.record(z.string(), z.unknown()),
  cancel_reason: z.string().nullable(),
  items: z.array(orderItemSchema),
  payment: orderPaymentSchema.nullable(),
  shipments: z.array(orderShipmentSchema),
  created_at: isoDateTimeSchema,
});
export type Order = z.infer<typeof orderSchema>;
export const orderResponseSchema = dataResponse(orderSchema);

export const orderSummarySchema = orderSchema
  .pick({ order_id: true, number: true, display_status: true, total_cents: true, created_at: true })
  .extend({
    item_count: z.number().int(),
    first_item_name: z.string().nullable(),
    first_item_image: z.string().nullable(),
  });
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export const orderListQuerySchema = paginationQuerySchema;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export const orderListResponseSchema = paginatedResponse(orderSummarySchema);

export const orderParamsSchema = z.object({ number: z.coerce.number().int().positive() });

// ── Cupom ──────────────────────────────────────────────────────────────────────
export const couponCheckBodySchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(40),
  subtotal_cents: z.number().int().min(0),
});
export const couponCheckSchema = z.object({
  code: z.string(),
  kind: z.enum(['percent', 'amount', 'free_shipping']),
  discount_cents: z.number().int(),
  free_shipping: z.boolean(),
});
export type CouponCheck = z.infer<typeof couponCheckSchema>;
export const couponCheckResponseSchema = dataResponse(couponCheckSchema);

// ── Admin ──────────────────────────────────────────────────────────────────────
export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: displayStatusSchema.optional(),
  /** Número do pedido, nome, e-mail ou código de SKU. */
  q: z.string().trim().min(1).max(120).optional(),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

export const adminOrderSummarySchema = orderSummarySchema.extend({
  contact_name: z.string(),
  contact_email: z.string(),
  payment_method: paymentMethodSchema.nullable(),
  payment_status: paymentStatusSchema,
});
export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;
export const adminOrderListResponseSchema = paginatedResponse(adminOrderSummarySchema);

export const orderShipBodySchema = z.object({
  carrier: z.string().trim().min(2).max(60),
  service: z.string().trim().max(80).optional(),
  tracking_code: z.string().trim().max(60).optional(),
});
export type OrderShipBody = z.infer<typeof orderShipBodySchema>;

export const orderCancelBodySchema = z.object({
  reason: z.string().trim().min(3, 'Diga o motivo').max(255),
});
export type OrderCancelBody = z.infer<typeof orderCancelBodySchema>;

// ── Conferência do carrinho ────────────────────────────────────────────────────
export const cartCheckBodySchema = z.object({ items: z.array(cartLineSchema).min(1).max(100) });
export const cartCheckLineSchema = z.object({
  sku_id: z.string().uuid(),
  /** O SKU ainda está à venda (ativo, com preço e produto publicado). */
  valid: z.boolean(),
  price_cents: z.number().int().nullable(),
  available: z.number().int(),
});
export type CartCheckLine = z.infer<typeof cartCheckLineSchema>;
export const cartCheckResponseSchema = dataResponse(z.array(cartCheckLineSchema));

// ── Painel: números dos pedidos (RF-ADM-05) ────────────────────────────────────
export const orderDashboardSchema = z.object({
  /** Pedidos pagos e não cancelados de hoje (horário de Brasília) e o que renderam. */
  today: z.object({ orders: z.number().int(), revenue_cents: z.number().int() }),
  /** Quantos pedidos há em cada estado que o cliente vê. */
  by_status: z.record(displayStatusSchema, z.number().int()),
  /** Vendas dos últimos 7 dias, do mais antigo ao de hoje. */
  last_7_days: z.array(
    z.object({ date: z.string(), orders: z.number().int(), revenue_cents: z.number().int() })
  ),
});
export type OrderDashboard = z.infer<typeof orderDashboardSchema>;
export const orderDashboardResponseSchema = dataResponse(orderDashboardSchema);
