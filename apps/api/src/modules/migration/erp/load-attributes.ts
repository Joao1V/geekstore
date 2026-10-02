import { prisma } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import type { CatalogPlan } from './plan-types';

export type AttributeValueIds = ReadonlyMap<string, { attributeId: string; valueId: string }>;

const keyOf = (attribute: string, label: string) => `${attribute}:${label}`;

function codeOf(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Garante os valores de atributo que o plano usa (cor Preto, tamanho GG...) e devolve
 * `atributo:rótulo -> ids`. Valor existente é reaproveitado (por código), nunca duplicado.
 * Os atributos em si (cor, tamanho, numeração) vêm da migração.
 */
export async function ensureAttributeValues(plan: CatalogPlan): Promise<AttributeValueIds> {
  const wanted = new Map<string, { attribute: string; label: string }>();
  for (const item of plan.items) {
    for (const [attribute, label] of Object.entries(item.attributes)) {
      wanted.set(keyOf(attribute, label), { attribute, label });
    }
  }

  const attributes = await prisma.attribute.findMany({
    select: { attribute_id: true, code: true },
  });
  const attributeId = new Map(attributes.map((a) => [a.code, a.attribute_id]));
  const result = new Map<string, { attributeId: string; valueId: string }>();

  for (const [key, { attribute, label }] of wanted) {
    const id = attributeId.get(attribute);
    if (!id) throw new Error(`Atributo "${attribute}" não existe; aplique as migrações.`);
    const code = codeOf(label);
    const existing = await prisma.attributeValue.findUnique({
      where: { attribute_id_code: { attribute_id: id, code } },
      select: { attribute_value_id: true },
    });
    const valueId =
      existing?.attribute_value_id ??
      (
        await prisma.attributeValue.create({
          data: { attribute_value_id: uuidv7(), attribute_id: id, code, label },
          select: { attribute_value_id: true },
        })
      ).attribute_value_id;
    result.set(key, { attributeId: id, valueId });
  }
  return result;
}

export const attributeKey = keyOf;

/**
 * Liga à categoria raiz (ex.: Vestuário) os atributos que seus itens usam; as subcategorias
 * herdam. Opcionais de propósito: o catálogo importado tem itens sem cor ou sem tamanho.
 */
export async function linkCategoryAttributes(
  plan: CatalogPlan,
  categoryIds: ReadonlyMap<string, string>,
  attributeIds: AttributeValueIds
): Promise<void> {
  const parentOf = new Map(plan.categories.map((c) => [c.key, c.parentKey]));
  const rootOf = (key: string): string => {
    let current = key;
    for (let guard = 0; guard < 5; guard++) {
      const parent = parentOf.get(current);
      if (!parent) return current;
      current = parent;
    }
    return current;
  };

  const byRoot = new Map<string, Set<string>>();
  for (const item of plan.items) {
    for (const attribute of Object.keys(item.attributes)) {
      const root = rootOf(item.categoryKey);
      byRoot.set(root, (byRoot.get(root) ?? new Set()).add(attribute));
    }
  }

  const attributeIdByCode = new Map<string, string>();
  for (const [key, ids] of attributeIds)
    attributeIdByCode.set(key.split(':')[0] ?? '', ids.attributeId);

  for (const [rootKey, codes] of byRoot) {
    const categoryId = categoryIds.get(rootKey);
    if (!categoryId) continue;
    for (const code of codes) {
      const attributeId = attributeIdByCode.get(code);
      if (!attributeId) continue;
      await prisma.categoryAttribute.upsert({
        where: { category_id_attribute_id: { category_id: categoryId, attribute_id: attributeId } },
        update: {},
        create: { category_id: categoryId, attribute_id: attributeId, is_required: false },
      });
    }
  }
}
