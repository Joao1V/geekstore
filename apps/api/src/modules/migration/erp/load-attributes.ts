import { ensureAttributeCatalog, prisma, suffixFor, valueCodeOf } from '@geekstore/db';
import { v7 as uuidv7 } from 'uuid';

import type { CatalogPlan } from './plan-types';

export type AttributeValueIds = ReadonlyMap<string, { attributeId: string; valueId: string }>;

const keyOf = (attribute: string, label: string) => `${attribute}:${label}`;

/**
 * Garante o catálogo de atributos e os valores que o plano usa (cor Preto, tamanho GG...) e devolve
 * `atributo:rótulo -> ids`. Valor existente é reaproveitado (por código), nunca duplicado; um valor
 * fora do catálogo é criado com sufixo de SKU derivado (único dentro do atributo).
 */
export async function ensureAttributeValues(plan: CatalogPlan): Promise<AttributeValueIds> {
  await ensureAttributeCatalog(prisma);

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
    if (!id) throw new Error(`Atributo "${attribute}" fora do catálogo.`);
    const code = valueCodeOf(label);
    const existing = await prisma.attributeValue.findUnique({
      where: { attribute_id_code: { attribute_id: id, code } },
      select: { attribute_value_id: true },
    });
    const valueId = existing?.attribute_value_id ?? (await createValue(id, attribute, label, code));
    result.set(key, { attributeId: id, valueId });
  }
  return result;
}

async function createValue(
  attributeId: string,
  attribute: string,
  label: string,
  code: string
): Promise<string> {
  const base = suffixFor(attribute, label);
  let suffix = base;
  for (
    let n = 2;
    await prisma.attributeValue.findFirst({
      where: { attribute_id: attributeId, sku_suffix: suffix },
    });
    n++
  ) {
    suffix = `${base.slice(0, 10)}${n}`;
  }
  const position = await prisma.attributeValue.count({ where: { attribute_id: attributeId } });
  const row = await prisma.attributeValue.create({
    data: {
      attribute_value_id: uuidv7(),
      attribute_id: attributeId,
      code,
      label,
      sku_suffix: suffix,
      position,
    },
    select: { attribute_value_id: true },
  });
  return row.attribute_value_id;
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

export type BrandIds = ReadonlyMap<string, string>;

/** Cria (ou reaproveita, pelo endereço) as marcas que o plano usa; devolve `nome -> brand_id`. */
export async function ensureBrands(plan: CatalogPlan): Promise<BrandIds> {
  const names = [
    ...new Set(plan.items.flatMap((item) => (item.brandName ? [item.brandName] : []))),
  ];
  const ids = new Map<string, string>();
  for (const name of names) {
    const slug = valueCodeOf(name);
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { brand_id: uuidv7(), name, slug },
      select: { brand_id: true },
    });
    ids.set(name, brand.brand_id);
  }
  return ids;
}
