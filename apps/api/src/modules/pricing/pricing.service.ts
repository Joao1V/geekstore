import { prisma } from '@geekstore/db';
import type { Price, PriceBulkBody } from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { type AuditEntry, writeAuditLogs } from '../../core/audit';

const SITE_CHANNEL_CODE = 'site';
const BULK_TX_TIMEOUT_MS = 30_000;

type PriceRow = {
  price_id: string;
  sku_id: string;
  price_cents: number;
  compare_at_cents: number | null;
  channel: { code: string };
};

const toPrice = (row: PriceRow): Price => ({
  price_id: row.price_id,
  sku_id: row.sku_id,
  channel_code: row.channel.code,
  price_cents: row.price_cents,
  compare_at_cents: row.compare_at_cents,
});

/** Preço vigente = maior `starts_at` já iniciado e sem `ends_at` vencido, por canal. */
export async function listCurrentPrices(skuId: string): Promise<Price[]> {
  const now = new Date();
  const rows = await prisma.price.findMany({
    where: {
      sku_id: skuId,
      starts_at: { lte: now },
      OR: [{ ends_at: null }, { ends_at: { gt: now } }],
    },
    orderBy: { starts_at: 'desc' },
    include: { channel: { select: { code: true } } },
  });

  const latestByChannel = new Map<string, PriceRow>();
  for (const row of rows) {
    if (!latestByChannel.has(row.channel.code)) latestByChannel.set(row.channel.code, row);
  }
  return [...latestByChannel.values()].map(toPrice);
}

/**
 * Edição em lote da grade: define o preço base do canal `site`. Cada mudança cria um novo registro
 * de vigência (`starts_at` = agora); o histórico nunca é sobrescrito. SKU já no preço pedido é
 * ignorado, para salvar a grade inteira não encher o histórico. Devolve quantos preços mudaram.
 */
export async function bulkSetSitePrices(actorId: string, body: PriceBulkBody): Promise<number> {
  const skuIds = body.items.map((item) => item.sku_id);
  if (new Set(skuIds).size !== skuIds.length) {
    throw new BadRequestError('O lote tem o mesmo SKU mais de uma vez.');
  }

  return prisma.$transaction(
    async (tx) => {
      const channel = await tx.channel.findUniqueOrThrow({ where: { code: SITE_CHANNEL_CODE } });
      const existingSkus = await tx.sku.count({ where: { sku_id: { in: skuIds } } });
      if (existingSkus !== skuIds.length) throw new NotFoundError('Algum SKU do lote não existe.');

      const now = new Date();
      const current = await tx.price.findMany({
        where: {
          sku_id: { in: skuIds },
          channel_id: channel.channel_id,
          starts_at: { lte: now },
          OR: [{ ends_at: null }, { ends_at: { gt: now } }],
        },
        orderBy: { starts_at: 'desc' },
      });
      const currentBySku = new Map<string, (typeof current)[number]>();
      for (const row of current) {
        if (!currentBySku.has(row.sku_id)) currentBySku.set(row.sku_id, row);
      }

      const audits: AuditEntry[] = [];
      for (const item of body.items) {
        const before = currentBySku.get(item.sku_id);
        if (before?.price_cents === item.price_cents) continue;

        const created = await tx.price.create({
          data: {
            sku_id: item.sku_id,
            channel_id: channel.channel_id,
            price_cents: item.price_cents,
            starts_at: now,
          },
        });
        audits.push({
          userId: actorId,
          entity: 'price',
          entityId: created.price_id,
          action: 'create',
          before,
          after: created,
        });
      }

      await writeAuditLogs(tx, audits);
      return audits.length;
    },
    { timeout: BULK_TX_TIMEOUT_MS }
  );
}
