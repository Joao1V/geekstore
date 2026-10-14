import { Prisma, prisma } from '@geekstore/db';
import type { NewsletterBody, StockAlertBody } from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeOutboxEvent } from '../../core/outbox/outbox';
import { readToken, signToken } from '../../core/security/signed-token';
import { skuAvailable } from '../storefront/storefront.sql';

export const NEWSLETTER_CONFIRM = 'newsletter-confirm';
export const NEWSLETTER_UNSUBSCRIBE = 'newsletter-unsubscribe';
const INVALID_LINK = 'Este link não é válido. Peça um novo.';
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;

export const confirmationToken = (subscriberId: string): string =>
  signToken(NEWSLETTER_CONFIRM, subscriberId);
export const unsubscribeToken = (subscriberId: string): string =>
  signToken(NEWSLETTER_UNSUBSCRIBE, subscriberId);

/**
 * Inscreve na newsletter com confirmação por e-mail (opt-in, RF-VIT-08). A resposta é sempre a mesma:
 * não revela se o e-mail já estava inscrito. Quem já confirmou não recebe outro e-mail; quem pediu há
 * pouco também não (evita usar o formulário para encher a caixa de alguém).
 */
export async function subscribeToNewsletter(body: NewsletterBody): Promise<void> {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: body.email } });
  if (existing?.confirmed_at && !existing.unsubscribed_at) return;

  await prisma.$transaction(async (tx) => {
    const subscriber =
      existing ??
      (await tx.newsletterSubscriber.create({ data: { email: body.email } }).catch((error) => {
        // Dois pedidos ao mesmo tempo: o UNIQUE deixa passar um; o outro só segue.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          return null;
        throw error;
      }));
    if (!subscriber) return;
    if (existing && !existing.unsubscribed_at) {
      const recent = await tx.outboxEvent.findFirst({
        where: {
          type: 'newsletter.confirmation_requested',
          entity_id: subscriber.newsletter_subscriber_id,
          created_at: { gt: new Date(Date.now() - CONFIRMATION_COOLDOWN_MS) },
        },
        select: { outbox_event_id: true },
      });
      if (recent) return;
    }
    // Quem cancelou e volta a pedir recomeça do zero: precisa confirmar de novo.
    if (existing?.unsubscribed_at) {
      await tx.newsletterSubscriber.update({
        where: { newsletter_subscriber_id: subscriber.newsletter_subscriber_id },
        data: { confirmed_at: null, unsubscribed_at: null },
      });
    }
    await writeOutboxEvent(tx, {
      type: 'newsletter.confirmation_requested',
      entityType: 'newsletter',
      entityId: subscriber.newsletter_subscriber_id,
    });
  });
}

export async function confirmNewsletter(token: string): Promise<void> {
  const id = readToken(NEWSLETTER_CONFIRM, token);
  if (!id) throw new BadRequestError(INVALID_LINK);
  const result = await prisma.newsletterSubscriber.updateMany({
    where: { newsletter_subscriber_id: id, confirmed_at: null },
    data: { confirmed_at: new Date(), unsubscribed_at: null },
  });
  if (result.count === 0) {
    const exists = await prisma.newsletterSubscriber.count({
      where: { newsletter_subscriber_id: id },
    });
    if (!exists) throw new BadRequestError(INVALID_LINK);
  }
}

export async function unsubscribeNewsletter(token: string): Promise<void> {
  const id = readToken(NEWSLETTER_UNSUBSCRIBE, token);
  if (!id) throw new BadRequestError(INVALID_LINK);
  const result = await prisma.newsletterSubscriber.updateMany({
    where: { newsletter_subscriber_id: id, unsubscribed_at: null },
    data: { unsubscribed_at: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.newsletterSubscriber.count({
      where: { newsletter_subscriber_id: id },
    });
    if (!exists) throw new BadRequestError(INVALID_LINK);
  }
}

/**
 * "Avise-me quando chegar" (RF-VIT-09). Só faz sentido para SKU à venda que está esgotado; um SKU
 * disponível responde 409 (a pessoa deve comprar). Repetir o pedido é inofensivo.
 */
export async function subscribeStockAlert(body: StockAlertBody): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ available: number | bigint }>>`
    SELECT ${skuAvailable} AS available
    FROM sku k
    JOIN product p ON p.product_id = k.product_id
    WHERE k.sku_id = ${body.sku_id}::uuid AND k.status = 'active' AND p.status = 'active'
      AND k.merged_into_sku_id IS NULL`;
  const row = rows[0];
  if (!row) throw new NotFoundError('Produto não encontrado.');
  if (Number(row.available) > 0) {
    throw new ConflictError('Este produto já está disponível. É só comprar!');
  }
  await prisma.stockAlert.upsert({
    where: { sku_id_email: { sku_id: body.sku_id, email: body.email } },
    create: { sku_id: body.sku_id, email: body.email },
    // Quem já foi avisado e quer ser avisado de novo (o item esgotou outra vez) reativa o pedido.
    update: { notified_at: null },
  });
}

const BACK_IN_STOCK_BATCH = 200;

/**
 * Procura pedidos de aviso cujo SKU voltou a ter estoque e dispara o e-mail pelo outbox. Marca
 * `notified_at` na mesma transação do evento: cada pedido avisa uma vez. Devolve quantos avisou.
 */
export async function notifyBackInStock(): Promise<number> {
  const due = await prisma.$queryRaw<Array<{ stock_alert_id: string }>>`
    SELECT a.stock_alert_id::text AS stock_alert_id
    FROM stock_alert a
    JOIN sku k ON k.sku_id = a.sku_id
    JOIN product p ON p.product_id = k.product_id
    WHERE a.notified_at IS NULL AND k.status = 'active' AND p.status = 'active'
      AND ${skuAvailable} > 0
    ORDER BY a.created_at
    LIMIT ${BACK_IN_STOCK_BATCH}`;
  let notified = 0;
  for (const { stock_alert_id: id } of due) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.stockAlert.updateMany({
        where: { stock_alert_id: id, notified_at: null },
        data: { notified_at: new Date() },
      });
      if (claimed.count === 0) return;
      await writeOutboxEvent(tx, {
        type: 'stock.back_in_stock',
        entityType: 'stock_alert',
        entityId: id,
      });
      notified += 1;
    });
  }
  return notified;
}
