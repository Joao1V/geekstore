import { Prisma, prisma } from '@geekstore/db';
import {
  type CartCheckLine,
  type CheckoutBody,
  type Order,
  PICKUP_SERVICE_CODE,
  PIX_DISCOUNT_PERCENT,
} from '@geekstore/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { envConfig } from '../../core/config/env';
import { paymentProvider, ttlMinutesOf } from '../payments/payment-provider';
import { toShippingItem } from '../shipping/shipping.service';
import { shippingOptionsFor } from '../shipping/shipping-options';
import { loadCartSkus } from './cart-lines';
import { checkCoupon, consumeCoupon } from './coupon.service';
import { approvePayment, reservationExpiry, reserveItems } from './order-flow';
import { orderInclude, toOrder } from './order-mapper';

const STORE_ZIP = envConfig.shipping.STORE_ZIP; // Barretos – SP: endereço da retirada na loja
const STORE_PICKUP_ADDRESS = {
  recipient: 'Retirada na loja',
  zip: STORE_ZIP,
  street: 'Loja GeekStore',
  number: 's/n',
  complement: null,
  neighborhood: 'Centro',
  city: 'Barretos',
  state: 'SP',
};
const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

async function loadOrder(orderId: string): Promise<Order> {
  const row = await prisma.order.findUniqueOrThrow({
    where: { order_id: orderId },
    include: orderInclude,
  });
  return toOrder(row);
}

type CreateInput = { customerId: string | null; idempotencyKey: string; body: CheckoutBody };

/**
 * Cria o pedido. Preço, frete, cupom e desconto saem do banco, nunca do navegador. O pedido congela
 * valores, endereço e nome/código de cada SKU. A reserva de estoque, o pedido e a cobrança acontecem
 * numa transação só: se faltar saldo, nada é criado. A chave de idempotência faz um clique repetido
 * (ou um timeout seguido de nova tentativa) devolver o MESMO pedido, sem duplicar nada (RF-PED-08).
 */
export async function createOrder({
  customerId,
  idempotencyKey,
  body,
}: CreateInput): Promise<Order> {
  const existing = await prisma.order.findUnique({ where: { idempotency_key: idempotencyKey } });
  if (existing) return loadOrder(existing.order_id);

  const { payment } = body;
  const isPickup = body.shipping_service === PICKUP_SERVICE_CODE;
  if (!isPickup && !body.shipping_address) {
    throw new BadRequestError('Informe o endereço de entrega.');
  }
  if (payment.method === 'card' && !payment.card_token) {
    throw new BadRequestError('Informe os dados do cartão.');
  }

  const lines = body.items;
  const skus = await loadCartSkus(lines.map((line) => line.sku_id));
  const items = lines.map((line) => {
    const sku = skus.get(line.sku_id);
    if (!sku) throw new BadRequestError('Algum item do carrinho não está mais à venda.');
    if (sku.available < line.quantity) {
      throw new ConflictError(
        `Sem estoque suficiente de "${sku.product_name}". Ajuste o carrinho.`
      );
    }
    return { line, sku };
  });

  const subtotal = items.reduce((sum, { line, sku }) => sum + sku.price_cents * line.quantity, 0);
  const address = isPickup ? STORE_PICKUP_ADDRESS : body.shipping_address;
  const quote = await shippingOptionsFor({
    zip: address?.zip ?? STORE_ZIP,
    items: items.map(({ line, sku }) => toShippingItem(sku, line.quantity)),
    subtotalCents: subtotal,
    // Retirada na loja não precisa de transportadora.
    provider: isPickup ? null : undefined,
  });
  const option = quote.options.find((candidate) => candidate.code === body.shipping_service);
  if (!option) throw new BadRequestError('Forma de entrega indisponível.');

  const coupon = body.coupon_code
    ? await checkCoupon(
        prisma,
        body.coupon_code,
        items.map(({ line, sku }) => ({
          category_id: sku.category_id,
          total_cents: sku.price_cents * line.quantity,
        }))
      )
    : null;
  const shipping = coupon?.free_shipping ? 0 : option.price_cents;
  const couponDiscount = coupon?.discount_cents ?? 0;
  const pixDiscount =
    payment.method === 'pix'
      ? Math.round(((subtotal - couponDiscount) * PIX_DISCOUNT_PERCENT) / 100)
      : 0;
  const discount = couponDiscount + pixDiscount;
  const total = subtotal + shipping - discount;

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      const [channel, warehouse] = await Promise.all([
        tx.channel.findUniqueOrThrow({ where: { code: 'site' } }),
        tx.location.findFirstOrThrow({
          where: { type: 'warehouse' },
          orderBy: { created_at: 'asc' },
        }),
      ]);
      const order = await tx.order.create({
        data: {
          channel_id: channel.channel_id,
          customer_id: customerId,
          contact_name: body.contact.name,
          contact_email: body.contact.email,
          contact_phone: body.contact.phone ?? null,
          contact_document: body.contact.document ?? null,
          subtotal_cents: subtotal,
          shipping_cents: shipping,
          discount_cents: discount,
          total_cents: total,
          coupon_code: coupon?.code ?? null,
          shipping_address: (address ?? STORE_PICKUP_ADDRESS) as Prisma.InputJsonValue,
          shipping_service: `${option.carrier} · ${option.service}`,
          idempotency_key: idempotencyKey,
          items: {
            create: items.map(({ line, sku }) => ({
              sku_id: sku.sku_id,
              sku_code: sku.code,
              name: sku.product_name,
              variant: sku.variant,
              image_url: sku.image_url,
              unit_price_cents: sku.price_cents,
              quantity: line.quantity,
              total_cents: sku.price_cents * line.quantity,
            })),
          },
        },
      });
      const ttl = ttlMinutesOf(payment.method);
      await reserveItems(
        tx,
        order.order_id,
        items.map(({ line, sku }) => ({
          sku_id: sku.sku_id,
          quantity: line.quantity,
          name: sku.product_name,
        })),
        warehouse.location_id,
        reservationExpiry(ttl),
        'first'
      );
      if (coupon) await consumeCoupon(tx, coupon.code);

      const charge = await paymentProvider.createCharge({
        orderNumber: order.number,
        amountCents: total,
        method: payment.method,
        installments: payment.installments,
        cardToken: payment.card_token,
      });
      // Cartão recusado: a compra inteira é desfeita (sem pedido, sem reserva); o cliente tenta de novo.
      if (charge.status === 'declined') {
        throw new BadRequestError(
          'Pagamento recusado. Confira os dados do cartão ou escolha outra forma de pagamento.'
        );
      }
      const created = await tx.payment.create({
        data: {
          order_id: order.order_id,
          provider: paymentProvider.name,
          external_id: charge.externalId,
          method: payment.method,
          status: charge.status,
          amount_cents: total,
          installments: payment.installments,
          details: charge.details as Prisma.InputJsonValue,
          expires_at: charge.expiresAt,
        },
      });
      if (charge.status === 'approved')
        await approvePayment(tx, order.order_id, created.payment_id);
      return order.order_id;
    }, TRANSACTION_OPTIONS);
    return loadOrder(orderId);
  } catch (error) {
    // Dois pedidos com a mesma chave ao mesmo tempo: o UNIQUE deixa passar um; o outro devolve o dele.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.order.findUnique({ where: { idempotency_key: idempotencyKey } });
      if (winner) return loadOrder(winner.order_id);
    }
    throw error;
  }
}

/** Confere cada item do carrinho: ainda está à venda, por quanto e quantos há. Nunca falha por item ruim. */
export async function checkCart(items: readonly { sku_id: string }[]): Promise<CartCheckLine[]> {
  const skus = await loadCartSkus(items.map((item) => item.sku_id));
  return items.map(({ sku_id }) => {
    const sku = skus.get(sku_id);
    return {
      sku_id,
      valid: Boolean(sku),
      price_cents: sku?.price_cents ?? null,
      available: sku?.available ?? 0,
    };
  });
}

/** Pedido pelo identificador (o UUID é o "segredo" de quem comprou sem conta). */
export async function getOrderById(orderId: string): Promise<Order> {
  const row = await prisma.order.findUnique({
    where: { order_id: orderId },
    include: orderInclude,
  });
  if (!row) throw new NotFoundError('Pedido não encontrado.');
  return toOrder(row);
}

/** Pedido de uma pessoa logada, pelo número. Pedido de outra pessoa responde como inexistente. */
export async function getCustomerOrder(customerId: string, number: number): Promise<Order> {
  const row = await prisma.order.findFirst({
    where: { number, customer_id: customerId },
    include: orderInclude,
  });
  if (!row) throw new NotFoundError('Pedido não encontrado.');
  return toOrder(row);
}
