import type { Prisma, prisma } from '@geekstore/db';
import type { CategoryAttribute } from '@geekstore/shared';

import { BadRequestError } from '../../core/_errors';

type Db = Prisma.TransactionClient | typeof prisma;

/** Carrega, junto do SKU, o código do atributo e do valor (o contrato usa os códigos). */
export const skuAttributeInclude = {
  attribute_values: {
    select: { attribute: { select: { code: true } }, value: { select: { code: true } } },
  },
} satisfies Prisma.SkuInclude;

type AttributeValueRow = { attribute: { code: string }; value: { code: string } };

/** `[{ cor, preto }, { tamanho, gg }]` -> `{ cor: 'preto', tamanho: 'gg' }`. */
export function attributesRecord(rows: AttributeValueRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.attribute.code, row.value.code]));
}

const MAX_DEPTH = 5;

/**
 * Atributos que a categoria pede: os dela e os herdados das categorias-mãe. A regra mais próxima
 * vence (a subcategoria pode tornar opcional o que a mãe pede).
 */
export async function categoryAttributeRules(
  db: Db,
  categoryId: string
): Promise<CategoryAttribute[]> {
  const rules = new Map<string, CategoryAttribute>();
  let currentId: string | null = categoryId;
  for (let depth = 0; currentId && depth < MAX_DEPTH; depth++) {
    const category: {
      category_id: string;
      parent_id: string | null;
      attributes: {
        is_required: boolean;
        attribute: { attribute_id: string; code: string; name: string };
      }[];
    } | null = await db.category.findUnique({
      where: { category_id: currentId },
      select: {
        category_id: true,
        parent_id: true,
        attributes: {
          orderBy: { position: 'asc' },
          select: {
            is_required: true,
            attribute: { select: { attribute_id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!category) break;
    for (const rule of category.attributes) {
      if (rules.has(rule.attribute.code)) continue;
      rules.set(rule.attribute.code, {
        ...rule.attribute,
        is_required: rule.is_required,
        inherited_from: category.category_id === categoryId ? null : category.category_id,
      });
    }
    currentId = category.parent_id;
  }
  return [...rules.values()];
}

export type ResolvedAttribute = { attribute_id: string; attribute_value_id: string };

/**
 * Confere `{ cor: 'preto' }` com o que a categoria pede e devolve os ids. Atributo que a categoria
 * não usa, valor que não existe ou atributo obrigatório ausente são recusados com a lista do que vale.
 */
export async function resolveAttributes(
  db: Db,
  categoryId: string,
  input: Record<string, string>
): Promise<ResolvedAttribute[]> {
  const rules = await categoryAttributeRules(db, categoryId);
  const allowed = new Map(rules.map((rule) => [rule.code, rule]));

  const unknown = Object.keys(input).filter((code) => !allowed.has(code));
  if (unknown.length > 0) {
    const valid = rules.map((rule) => rule.code).join(', ') || 'nenhum';
    throw new BadRequestError(
      `A categoria não usa o atributo: ${unknown.join(', ')}. Atributos da categoria: ${valid}.`
    );
  }
  const missing = rules.filter((rule) => rule.is_required && !input[rule.code]);
  if (missing.length > 0) {
    throw new BadRequestError(
      `Atributo obrigatório ausente: ${missing.map((r) => r.name).join(', ')}.`
    );
  }

  const entries = Object.entries(input);
  if (entries.length === 0) return [];
  const values = await db.attributeValue.findMany({
    where: { OR: entries.map(([code, value]) => ({ code: value, attribute: { code } })) },
    select: {
      attribute_value_id: true,
      attribute_id: true,
      code: true,
      attribute: { select: { code: true } },
    },
  });
  const byKey = new Map(values.map((v) => [`${v.attribute.code}:${v.code}`, v]));
  return entries.map(([code, value]) => {
    const found = byKey.get(`${code}:${value}`);
    if (!found) throw new BadRequestError(`Valor "${value}" não existe no atributo ${code}.`);
    return { attribute_id: found.attribute_id, attribute_value_id: found.attribute_value_id };
  });
}

/** Troca os atributos do SKU pelos informados (substituição completa). */
export async function replaceSkuAttributes(
  tx: Prisma.TransactionClient,
  skuId: string,
  resolved: ResolvedAttribute[]
): Promise<void> {
  await tx.skuAttributeValue.deleteMany({ where: { sku_id: skuId } });
  if (resolved.length > 0) {
    await tx.skuAttributeValue.createMany({
      data: resolved.map((item) => ({ sku_id: skuId, ...item })),
    });
  }
}
