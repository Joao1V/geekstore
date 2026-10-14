import type { Prisma } from '@geekstore/db';
import { displayStatusOf, type Order, type OrderSummary } from '@geekstore/shared';

export const orderInclude = {
  items: true,
  payments: { orderBy: { created_at: 'desc' }, take: 1 },
  shipments: { orderBy: { created_at: 'asc' } },
  refunds: { orderBy: { created_at: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export function toOrder(row: OrderRow): Order {
  const payment = row.payments[0];
  return {
    order_id: row.order_id,
    number: row.number,
    status: row.status,
    payment_status: row.payment_status,
    fulfillment_status: row.fulfillment_status,
    display_status: displayStatusOf(row),
    subtotal_cents: row.subtotal_cents,
    shipping_cents: row.shipping_cents,
    discount_cents: row.discount_cents,
    total_cents: row.total_cents,
    coupon_code: row.coupon_code,
    contact: {
      name: row.contact_name,
      email: row.contact_email,
      phone: row.contact_phone,
      document: row.contact_document,
    },
    shipping_service: row.shipping_service,
    shipping_address: row.shipping_address as Record<string, unknown>,
    cancel_reason: row.cancel_reason,
    items: row.items.map((item) => ({
      sku_id: item.sku_id,
      sku_code: item.sku_code,
      name: item.name,
      variant: item.variant,
      image_url: item.image_url,
      unit_price_cents: item.unit_price_cents,
      quantity: item.quantity,
      total_cents: item.total_cents,
    })),
    payment: payment
      ? {
          method: payment.method,
          status: payment.status,
          installments: payment.installments,
          amount_cents: payment.amount_cents,
          details: (payment.details as Record<string, unknown> | null) ?? null,
          expires_at: iso(payment.expires_at),
        }
      : null,
    shipments: row.shipments.map((shipment) => ({
      carrier: shipment.carrier,
      service: shipment.service,
      tracking_code: shipment.tracking_code,
      status: shipment.status,
      shipped_at: iso(shipment.shipped_at),
      delivered_at: iso(shipment.delivered_at),
    })),
    refunded_cents: row.refunds
      .filter((refund) => refund.status === 'succeeded')
      .reduce((sum, refund) => sum + refund.amount_cents, 0),
    refunds: row.refunds.map((refund) => ({
      refund_id: refund.refund_id,
      amount_cents: refund.amount_cents,
      status: refund.status,
      reason: refund.reason,
      error: refund.error,
      created_at: refund.created_at.toISOString(),
    })),
    created_at: row.created_at.toISOString(),
  };
}

export function toOrderSummary(row: OrderRow): OrderSummary {
  const [first] = row.items;
  return {
    order_id: row.order_id,
    number: row.number,
    display_status: displayStatusOf(row),
    total_cents: row.total_cents,
    created_at: row.created_at.toISOString(),
    item_count: row.items.reduce((sum, item) => sum + item.quantity, 0),
    first_item_name: first?.name ?? null,
    first_item_image: first?.image_url ?? null,
  };
}
