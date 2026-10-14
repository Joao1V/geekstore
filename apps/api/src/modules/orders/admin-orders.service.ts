import { type Prisma, prisma } from '@geekstore/db';
import type {
  AdminOrderListQuery,
  AdminOrderSummary,
  DisplayStatus,
  Order,
  OrderCancelBody,
  OrderDashboard,
  OrderShipBody,
  Paginated,
} from '@geekstore/shared';
import { ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit/write-audit-log';
import { buildMeta, skipTake } from '../../core/http/pagination';
import { writeOutboxEvent } from '../../core/outbox/outbox';
import { cancelOrder, consumeOrderStock } from './order-flow';
import { orderInclude, toOrder, toOrderSummary } from './order-mapper';

/** O filtro por "estado que o cliente vê" traduzido para as colunas dos três estados do pedido. */
const STATUS_FILTERS: Record<DisplayStatus, Prisma.OrderWhereInput> = {
  awaiting_payment: { status: 'open', payment_status: 'pending' },
  paid: { status: 'open', payment_status: { not: 'pending' }, fulfillment_status: 'not_picked' },
  picking: { status: 'open', fulfillment_status: 'picking' },
  shipped: { status: 'open', fulfillment_status: { in: ['shipped', 'partially_shipped'] } },
  delivered: { fulfillment_status: 'delivered' },
  cancelled: { status: 'cancelled' },
};

export async function listAdminOrders(
  query: AdminOrderListQuery
): Promise<Paginated<AdminOrderSummary>> {
  const term = query.q?.trim();
  const asNumber = term && /^#?\d+$/.test(term) ? Number(term.replace('#', '')) : null;
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? STATUS_FILTERS[query.status] : {}),
    ...(term
      ? {
          OR: [
            ...(asNumber !== null ? [{ number: asNumber }] : []),
            { contact_name: { contains: term, mode: 'insensitive' as const } },
            { contact_email: { contains: term, mode: 'insensitive' as const } },
            { items: { some: { sku_code: { contains: term, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: [{ created_at: 'desc' }, { number: 'desc' }],
      ...skipTake(query.page, query.page_size),
    }),
    prisma.order.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      ...toOrderSummary(row),
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      payment_method: row.payments[0]?.method ?? null,
      payment_status: row.payment_status,
    })),
    meta: buildMeta(query.page, query.page_size, total),
  };
}

async function loadByNumber(db: Prisma.TransactionClient | typeof prisma, number: number) {
  const row = await db.order.findUnique({ where: { number }, include: orderInclude });
  if (!row) throw new NotFoundError('Pedido não encontrado.');
  return row;
}

export async function getAdminOrder(number: number): Promise<Order> {
  return toOrder(await loadByNumber(prisma, number));
}

/** Pedido pago que entrou na fila de separação do depósito. */
export async function startPicking(actorId: string, number: number): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await loadByNumber(tx, number);
    if (order.status !== 'open' || order.payment_status !== 'approved') {
      throw new ConflictError('Só um pedido pago e em aberto pode ir para separação.');
    }
    if (order.fulfillment_status !== 'not_picked') {
      throw new ConflictError('Este pedido já está em separação ou foi enviado.');
    }
    await tx.order.update({
      where: { order_id: order.order_id },
      data: { fulfillment_status: 'picking' },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'order',
      entityId: order.order_id,
      action: 'update',
      before: { fulfillment_status: 'not_picked' },
      after: { fulfillment_status: 'picking' },
    });
    return toOrder(await loadByNumber(tx, number));
  });
}

/**
 * Envia o pedido: AGORA o estoque sai de verdade (a reserva comprometida vira saída, RF-EST-02) e o
 * envio ganha o rastreio. O UPDATE condicional do estado impede enviar duas vezes (dois cliques).
 */
export async function shipOrder(
  actorId: string,
  number: number,
  body: OrderShipBody
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await loadByNumber(tx, number);
    if (order.status !== 'open' || order.payment_status !== 'approved') {
      throw new ConflictError('Só um pedido pago e em aberto pode ser enviado.');
    }
    const claimed = await tx.order.updateMany({
      where: { order_id: order.order_id, fulfillment_status: { in: ['not_picked', 'picking'] } },
      data: { fulfillment_status: 'shipped' },
    });
    if (claimed.count === 0) throw new ConflictError('Este pedido já foi enviado.');
    await consumeOrderStock(tx, order.order_id);
    await tx.shipment.create({
      data: {
        order_id: order.order_id,
        carrier: body.carrier,
        service: body.service ?? order.shipping_service,
        tracking_code: body.tracking_code ?? null,
        status: 'shipped',
        shipped_at: new Date(),
      },
    });
    await writeOutboxEvent(tx, {
      type: 'order.shipped',
      entityType: 'order',
      entityId: order.order_id,
      payload: { carrier: body.carrier, tracking_code: body.tracking_code ?? null },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'order',
      entityId: order.order_id,
      action: 'update',
      before: { fulfillment_status: order.fulfillment_status },
      after: {
        fulfillment_status: 'shipped',
        carrier: body.carrier,
        tracking_code: body.tracking_code ?? null,
      },
    });
    return toOrder(await loadByNumber(tx, number));
  });
}

export async function markDelivered(actorId: string, number: number): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await loadByNumber(tx, number);
    if (
      order.fulfillment_status !== 'shipped' &&
      order.fulfillment_status !== 'partially_shipped'
    ) {
      throw new ConflictError('Só um pedido enviado pode ser marcado como entregue.');
    }
    await tx.shipment.updateMany({
      where: { order_id: order.order_id, status: 'shipped' },
      data: { status: 'delivered', delivered_at: new Date() },
    });
    await tx.order.update({
      where: { order_id: order.order_id },
      data: { fulfillment_status: 'delivered', status: 'completed' },
    });
    await writeOutboxEvent(tx, {
      type: 'order.delivered',
      entityType: 'order',
      entityId: order.order_id,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'order',
      entityId: order.order_id,
      action: 'update',
      before: { fulfillment_status: order.fulfillment_status },
      after: { fulfillment_status: 'delivered', status: 'completed' },
    });
    return toOrder(await loadByNumber(tx, number));
  });
}

/** Cancela antes da expedição e devolve a reserva ao saldo. Estorno do dinheiro é à parte (F4). */
export async function cancelAdminOrder(
  actorId: string,
  number: number,
  body: OrderCancelBody
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await loadByNumber(tx, number);
    if (order.status === 'cancelled') throw new ConflictError('Este pedido já está cancelado.');
    await cancelOrder(tx, order.order_id, body.reason);
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'order',
      entityId: order.order_id,
      action: 'update',
      before: { status: order.status },
      after: {
        status: 'cancelled',
        reason: body.reason,
        refund_pending: order.payment_status === 'approved',
      },
    });
    return toOrder(await loadByNumber(tx, number));
  });
}

const STORE_TIME_ZONE = 'America/Sao_Paulo';
const DASHBOARD_DAYS = 7;

/** Números do painel. "Hoje" e os dias do gráfico seguem o horário de Brasília, não o do servidor. */
export async function getOrderDashboard(): Promise<OrderDashboard> {
  const statuses = Object.keys(STATUS_FILTERS) as DisplayStatus[];
  const counts = await Promise.all(
    statuses.map((status) => prisma.order.count({ where: STATUS_FILTERS[status] }))
  );
  const days = await prisma.$queryRaw<{ day: string; orders: bigint; revenue: bigint | null }[]>`
    WITH series AS (
      SELECT generate_series(
        (now() AT TIME ZONE ${STORE_TIME_ZONE})::date - ${DASHBOARD_DAYS - 1}::int,
        (now() AT TIME ZONE ${STORE_TIME_ZONE})::date,
        interval '1 day')::date AS day
    )
    SELECT to_char(s.day, 'YYYY-MM-DD') AS day,
           COUNT(o.order_id) AS orders,
           COALESCE(SUM(o.total_cents), 0) AS revenue
    FROM series s
    LEFT JOIN "order" o
      ON (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE ${STORE_TIME_ZONE})::date = s.day
     AND o.status <> 'cancelled' AND o.payment_status <> 'pending'
    GROUP BY s.day ORDER BY s.day`;
  const last7 = days.map((row) => ({
    date: row.day,
    orders: Number(row.orders),
    revenue_cents: Number(row.revenue ?? 0),
  }));
  const today = last7.at(-1) ?? { orders: 0, revenue_cents: 0 };
  return {
    today: { orders: today.orders, revenue_cents: today.revenue_cents },
    by_status: Object.fromEntries(statuses.map((status, i) => [status, counts[i] ?? 0])) as Record<
      DisplayStatus,
      number
    >,
    last_7_days: last7,
  };
}
