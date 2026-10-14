import { createHash } from 'node:crypto';
import { type Prisma, prisma } from '@geekstore/db';
import type {
  DuplicateGroup,
  DuplicateItem,
  DuplicateLevel,
  DuplicateListQuery,
  DuplicateMergeBody,
  DuplicateMergeCertainResult,
  DuplicateMergeResult,
  DuplicateSummary,
  Paginated,
} from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { utcNow } from '../../core/db/sql';
import { buildMeta, skipTake } from '../../core/http/pagination';
import { movementRow, recordMovements } from '../stock/movement-writer';
import { addOnHand, lockLevel, subtractOnHand } from '../stock/stock-ledger';

const MERGE_REFERENCE = 'sku_merge';
const LEVEL_ORDER: Record<DuplicateLevel, number> = { certain: 0, likely: 1, review: 2 };

type RawRow = {
  key: string;
  product_id: string;
  sku_id: string;
  name: string;
  code: string;
  legacy_code: string | null;
  ean: string | null;
  price_cents: number | null;
  stock: number | bigint | string;
  photos: number | bigint;
  thumbnail_url: string | null;
};

/**
 * Produtos SIMPLES (1 SKU, ainda não mesclados nem arquivados) cujo nome, sem acento, pontuação e
 * "#código", se repete em outro produto. Variações (vários SKUs no mesmo produto) ficam de fora.
 * As CTEs são MATERIALIZED de propósito: sem isso o Postgres as reavalia por linha (16 s em 26 mil SKUs).
 */
async function loadCandidates(): Promise<RawRow[]> {
  return prisma.$queryRaw<RawRow[]>`
    WITH single AS MATERIALIZED (
      SELECT product_id FROM sku GROUP BY product_id HAVING COUNT(*) = 1
    ), simple AS MATERIALIZED (
      SELECT p.product_id, p.name, s.sku_id, s.code, s.legacy_code, s.ean,
             regexp_replace(lower(unaccent(regexp_replace(p.name, '#[0-9]+', '', 'g'))), '[^a-z0-9]', '', 'g') AS key
      FROM product p
      JOIN single one ON one.product_id = p.product_id
      JOIN sku s ON s.product_id = p.product_id
      WHERE p.status <> 'archived' AND s.merged_into_sku_id IS NULL
    ), repeated AS MATERIALIZED (
      SELECT key FROM simple WHERE key <> '' GROUP BY key HAVING COUNT(*) > 1
    )
    SELECT sm.key, sm.product_id, sm.sku_id, sm.name, sm.code, sm.legacy_code, sm.ean,
           (
             SELECT pr.price_cents
             FROM price pr JOIN channel c ON c.channel_id = pr.channel_id
             WHERE pr.sku_id = sm.sku_id AND c.code = 'site'
               AND pr.starts_at <= ${utcNow} AND (pr.ends_at IS NULL OR pr.ends_at > ${utcNow})
             ORDER BY pr.starts_at DESC LIMIT 1
           ) AS price_cents,
           (
             SELECT COALESCE(SUM(sl.on_hand), 0)
             FROM stock_level sl JOIN location l ON l.location_id = sl.location_id
             WHERE sl.sku_id = sm.sku_id AND l.type <> 'quarantine'
           ) AS stock,
           (SELECT COUNT(*) FROM media m WHERE m.product_id = sm.product_id) AS photos,
           (
             SELECT m.url FROM media m WHERE m.product_id = sm.product_id
             ORDER BY m.position, m.created_at LIMIT 1
           ) AS thumbnail_url
    FROM simple sm JOIN repeated r ON r.key = sm.key
    ORDER BY sm.key, sm.legacy_code`;
}

const toItem = (row: RawRow): DuplicateItem => ({
  product_id: row.product_id,
  sku_id: row.sku_id,
  name: row.name,
  code: row.code,
  legacy_code: row.legacy_code,
  ean: row.ean,
  price_cents: row.price_cents === null ? null : Number(row.price_cents),
  stock: Number(row.stock),
  photos: Number(row.photos),
  thumbnail_url: row.thumbnail_url,
});

/** Chave estável do grupo: hash dos SKUs (se entrar um item novo, a chave muda e o grupo volta a ser sugerido). */
export function groupKeyOf(skuIds: readonly string[]): string {
  return createHash('sha256')
    .update([...skuIds].sort().join(','))
    .digest('hex')
    .slice(0, 32);
}

const allEqual = <T>(values: readonly T[]) => values.every((value) => value === values[0]);

export function classify(items: readonly DuplicateItem[]): {
  level: DuplicateLevel;
  reasons: string[];
} {
  const sameEan = items[0]?.ean != null && allEqual(items.map((item) => item.ean));
  const prices = items.map((item) => item.price_cents);
  const samePrice = prices[0] != null && allEqual(prices);
  const reasons = [
    'mesmo nome',
    sameEan ? 'mesmo EAN' : 'EAN diferente ou vazio',
    samePrice ? 'mesmo preço' : 'preço diferente',
  ];
  if (sameEan && samePrice) return { level: 'certain', reasons };
  if (sameEan || samePrice) return { level: 'likely', reasons };
  return { level: 'review', reasons };
}

/** Sugere manter o que tem mais fotos; empatando, o código do ERP mais antigo. */
export function pickSurvivor(items: readonly DuplicateItem[]): DuplicateItem {
  const oldest = (item: DuplicateItem) => Number(item.legacy_code ?? Number.MAX_SAFE_INTEGER);
  const [first] = [...items].sort((a, b) => b.photos - a.photos || oldest(a) - oldest(b));
  if (!first) throw new Error('Grupo vazio.');
  return first;
}

/** Todos os grupos ainda em aberto (sem os mesclados e os marcados como "são diferentes"). */
export async function listAllDuplicateGroups(): Promise<DuplicateGroup[]> {
  const [rows, dismissed] = await Promise.all([
    loadCandidates(),
    prisma.duplicateDismissal.findMany({ select: { group_key: true } }),
  ]);
  const dismissedKeys = new Set(dismissed.map((row) => row.group_key));

  const byName = new Map<string, DuplicateItem[]>();
  for (const row of rows) byName.set(row.key, [...(byName.get(row.key) ?? []), toItem(row)]);

  return [...byName.values()]
    .map((items): DuplicateGroup => {
      const { level, reasons } = classify(items);
      return {
        key: groupKeyOf(items.map((item) => item.sku_id)),
        level,
        reasons,
        items,
        suggested_survivor_sku_id: pickSurvivor(items).sku_id,
        total_stock: items.reduce((sum, item) => sum + item.stock, 0),
      };
    })
    .filter((group) => !dismissedKeys.has(group.key))
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        (a.items[0]?.name ?? '').localeCompare(b.items[0]?.name ?? '', 'pt-BR')
    );
}

export async function listDuplicateGroups(
  query: DuplicateListQuery
): Promise<Paginated<DuplicateGroup>> {
  const groups = (await listAllDuplicateGroups()).filter(
    (group) => !query.level || group.level === query.level
  );
  const { skip, take } = skipTake(query.page, query.page_size);
  return {
    data: groups.slice(skip, skip + take),
    meta: buildMeta(query.page, query.page_size, groups.length),
  };
}

export async function getDuplicateSummary(): Promise<DuplicateSummary> {
  const summary: DuplicateSummary = { certain: 0, likely: 0, review: 0 };
  for (const group of await listAllDuplicateGroups()) summary[group.level] += 1;
  return summary;
}

// ── Mesclar ───────────────────────────────────────────────────────────────────

/**
 * Mescla duplicatas num SKU que fica: o estoque de cada duplicata é TRANSFERIDO pelo livro-razão
 * (saída lá, entrada aqui, com motivo), a duplicata fica inativa e o produto dela arquivado. O
 * `legacy_code` da duplicata é mantido (a reimportação do ERP e a integração continuam
 * reconhecendo o código antigo) e `merged_into_sku_id` aponta para o SKU que ficou. Se o SKU que
 * fica não tem foto, aproveita a da duplicata.
 */
async function mergeInTransaction(
  tx: Prisma.TransactionClient,
  actorId: string,
  survivorId: string,
  duplicateIds: readonly string[]
): Promise<DuplicateMergeResult> {
  if (duplicateIds.includes(survivorId)) {
    throw new BadRequestError('O SKU que fica não pode estar entre as duplicatas.');
  }
  const survivor = await tx.sku.findUnique({
    where: { sku_id: survivorId },
    include: { product: { select: { product_id: true, status: true } } },
  });
  if (!survivor) throw new NotFoundError('SKU que deve ficar não encontrado.');
  if (survivor.merged_into_sku_id) throw new BadRequestError('Esse SKU já foi mesclado em outro.');

  let survivorHasMedia = (await tx.media.count({ where: { product_id: survivor.product_id } })) > 0;
  let unitsMoved = 0;

  for (const duplicateId of duplicateIds) {
    const duplicate = await tx.sku.findUnique({
      where: { sku_id: duplicateId },
      include: {
        product: { include: { skus: { select: { sku_id: true } } } },
        stock_levels: true,
      },
    });
    if (!duplicate) throw new NotFoundError('SKU duplicado não encontrado.');
    if (duplicate.merged_into_sku_id)
      throw new BadRequestError(`${duplicate.code} já foi mesclado.`);
    if (duplicate.product.skus.length !== 1) {
      throw new BadRequestError(
        `${duplicate.code} faz parte de um produto com variações: só produtos simples se mesclam.`
      );
    }

    for (const level of duplicate.stock_levels) {
      const slot = { skuId: duplicate.sku_id, locationId: level.location_id };
      const locked = await lockLevel(tx, slot);
      if (locked.reserved > 0) {
        throw new ConflictError(
          `${duplicate.code} tem ${locked.reserved} unidade(s) reservada(s); conclua os pedidos antes de mesclar.`
        );
      }
      if (locked.on_hand <= 0) continue;
      const outAfter = await subtractOnHand(tx, slot, locked.on_hand);
      const inAfter = await addOnHand(
        tx,
        { skuId: survivor.sku_id, locationId: level.location_id },
        locked.on_hand
      );
      await recordMovements(tx, [
        movementRow(
          {
            sku_id: duplicate.sku_id,
            location_id: level.location_id,
            type: 'outbound',
            quantity: -locked.on_hand,
            reason: `Mesclagem de duplicado: transferido para ${survivor.code}`,
            reference_type: MERGE_REFERENCE,
            reference_id: survivor.sku_id,
            user_id: actorId,
          },
          outAfter
        ),
        movementRow(
          {
            sku_id: survivor.sku_id,
            location_id: level.location_id,
            type: 'inbound',
            quantity: locked.on_hand,
            reason: `Mesclagem de duplicado: recebido de ${duplicate.code}`,
            reference_type: MERGE_REFERENCE,
            reference_id: duplicate.sku_id,
            user_id: actorId,
          },
          inAfter
        ),
      ]);
      unitsMoved += locked.on_hand;
    }

    if (!survivorHasMedia) {
      const moved = await tx.media.updateMany({
        where: { product_id: duplicate.product_id },
        data: { product_id: survivor.product_id, sku_id: null },
      });
      survivorHasMedia = moved.count > 0;
    }

    await tx.sku.update({
      where: { sku_id: duplicate.sku_id },
      data: { status: 'inactive', merged_into_sku_id: survivor.sku_id },
    });
    await tx.product.update({
      where: { product_id: duplicate.product_id },
      data: { status: 'archived' },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'sku',
      entityId: duplicate.sku_id,
      action: 'update',
      before: { status: duplicate.status, merged_into_sku_id: null },
      after: { status: 'inactive', merged_into_sku_id: survivor.sku_id, merge: 'duplicate' },
    });
  }
  return { skus_archived: duplicateIds.length, units_moved: unitsMoved };
}

export async function mergeSkus(
  actorId: string,
  body: DuplicateMergeBody
): Promise<DuplicateMergeResult> {
  return prisma.$transaction(
    (tx) => mergeInTransaction(tx, actorId, body.survivor_sku_id, body.duplicate_sku_ids),
    {
      timeout: 30_000,
    }
  );
}

/** Mescla de uma vez todos os grupos "certeza". Com `dry_run` só mostra o que seria feito. */
export async function mergeCertainDuplicates(
  actorId: string,
  dryRun: boolean,
  /** Restringe a estes grupos (pela chave). Só os testes usam, para não mexer no catálogo inteiro. */
  onlyKeys?: ReadonlySet<string>
): Promise<DuplicateMergeCertainResult> {
  const certain = (await listAllDuplicateGroups()).filter(
    (group) => group.level === 'certain' && (!onlyKeys || onlyKeys.has(group.key))
  );
  const result: DuplicateMergeCertainResult = {
    groups: 0,
    skus_archived: 0,
    units_moved: 0,
    skipped: [],
    dry_run: dryRun,
  };

  for (const group of certain) {
    const duplicates = group.items.filter(
      (item) => item.sku_id !== group.suggested_survivor_sku_id
    );
    if (dryRun) {
      result.groups += 1;
      result.skus_archived += duplicates.length;
      result.units_moved += duplicates.reduce((sum, item) => sum + item.stock, 0);
      continue;
    }
    try {
      const done = await mergeSkus(actorId, {
        survivor_sku_id: group.suggested_survivor_sku_id,
        duplicate_sku_ids: duplicates.map((item) => item.sku_id),
      });
      result.groups += 1;
      result.skus_archived += done.skus_archived;
      result.units_moved += done.units_moved;
    } catch (error) {
      // Um grupo com problema (ex.: reserva ativa) não impede os outros.
      result.skipped.push({
        key: group.key,
        reason: error instanceof Error ? error.message : 'Falha ao mesclar.',
      });
    }
  }
  return result;
}

/** "São produtos diferentes": o grupo deixa de ser sugerido (até entrar um item novo nele). */
export async function dismissDuplicates(actorId: string, skuIds: readonly string[]): Promise<void> {
  const found = await prisma.sku.count({ where: { sku_id: { in: [...skuIds] } } });
  if (found !== new Set(skuIds).size) throw new NotFoundError('Algum SKU do grupo não existe.');
  const key = groupKeyOf(skuIds);
  await prisma.duplicateDismissal.upsert({
    where: { group_key: key },
    update: {},
    create: { group_key: key, user_id: actorId },
  });
}
