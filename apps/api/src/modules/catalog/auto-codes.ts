import { categoryNode, isKnownCategory, type Prisma } from '@geekstore/db';

import { formatBaseCode, joinSuffixes } from './sku-codes';

const FALLBACK_TYPE = 'GEN';
const MAX_ATTEMPTS = 20;

/** Tipo do código (CNC, CAM...) da categoria; categoria criada à mão, fora da taxonomia, usa GEN. */
async function typeOfCategory(tx: Prisma.TransactionClient, categoryId: string): Promise<string> {
  const category = await tx.category.findUniqueOrThrow({
    where: { category_id: categoryId },
    select: { slug: true },
  });
  return (
    (isKnownCategory(category.slug) ? categoryNode(category.slug).prefix : null) ?? FALLBACK_TYPE
  );
}

/**
 * Próximo número do tipo. O INSERT ... ON CONFLICT trava a linha do contador até o fim da transação:
 * duas criações simultâneas não recebem o mesmo número, e se a transação desfaz, o contador desfaz junto.
 */
async function nextNumber(tx: Prisma.TransactionClient, type: string): Promise<number> {
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO sku_sequence (prefix, last_value, updated_at) VALUES (${type}, 1, now())
    ON CONFLICT (prefix) DO UPDATE SET last_value = sku_sequence.last_value + 1, updated_at = now()
    RETURNING last_value`;
  return rows[0]?.last_value ?? 1;
}

/** Sufixo de SKU das variações ({ cor: 'preto', tamanho: 'gg' } -> "PT-GG"), pelos sufixos cadastrados. */
export async function skuSuffix(
  tx: Prisma.TransactionClient,
  attributes: Record<string, string>
): Promise<string> {
  const entries = Object.entries(attributes);
  if (entries.length === 0) return '';
  const values = await tx.attributeValue.findMany({
    where: {
      OR: entries.map(([attribute, value]) => ({ code: value, attribute: { code: attribute } })),
    },
    select: { sku_suffix: true, attribute: { select: { code: true } } },
  });
  return joinSuffixes(
    Object.fromEntries(values.map((row) => [row.attribute.code, row.sku_suffix]))
  );
}

export const withSuffix = (base: string, suffix: string): string =>
  suffix ? `${base}-${suffix}` : base;

/**
 * Código-base novo (CNC-00042) cujo produto e SKUs ainda não existem. Só repete a busca se alguém
 * cadastrou à mão um código dessa faixa; a numeração nunca volta atrás.
 */
export async function allocateProductCode(
  tx: Prisma.TransactionClient,
  categoryId: string,
  skuSuffixes: readonly string[]
): Promise<string> {
  const type = await typeOfCategory(tx, categoryId);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const base = formatBaseCode(type, await nextNumber(tx, type));
    const skuCodes = skuSuffixes.map((suffix) => withSuffix(base, suffix));
    const [product, skus] = await Promise.all([
      tx.product.findUnique({ where: { code: base }, select: { product_id: true } }),
      tx.sku.count({ where: { code: { in: skuCodes } } }),
    ]);
    if (!product && skus === 0) return base;
  }
  throw new Error(`Não foi possível gerar um código livre para o tipo ${type}.`);
}
