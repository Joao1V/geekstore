import { prisma, suffixFor } from '@geekstore/db';
import type {
  Attribute,
  AttributeBody,
  AttributeCreateBody,
  AttributeValue,
  AttributeValueBody,
  CategoryAttribute,
  CategoryAttributesBody,
} from '@geekstore/shared';

import { ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { categoryAttributeRules } from './sku-attributes';

const valueSelect = {
  attribute_value_id: true,
  code: true,
  label: true,
  sku_suffix: true,
  position: true,
  color_hex: true,
  is_active: true,
} as const;

function slugCode(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function listAttributes(): Promise<Attribute[]> {
  const rows = await prisma.attribute.findMany({
    orderBy: { position: 'asc' },
    include: { values: { orderBy: [{ position: 'asc' }, { label: 'asc' }], select: valueSelect } },
  });
  return rows.map(({ attribute_id, code, name, position, is_active, values }) => ({
    attribute_id,
    code,
    name,
    position,
    is_active,
    values,
  }));
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadAttribute(db: Tx, id: string): Promise<Attribute> {
  const row = await db.attribute.findUniqueOrThrow({
    where: { attribute_id: id },
    include: { values: { orderBy: [{ position: 'asc' }, { label: 'asc' }], select: valueSelect } },
  });
  const { attribute_id, code, name, position, is_active, values } = row;
  return { attribute_id, code, name, position, is_active, values };
}

function assertUniqueValues(values: AttributeBody['values']): void {
  const suffixes = new Set<string>();
  const codes = new Set<string>();
  for (const value of values) {
    const suffix = value.sku_suffix.toUpperCase();
    const code = slugCode(value.label);
    if (suffixes.has(suffix)) throw new ConflictError(`Código "${suffix}" repetido na lista.`);
    if (codes.has(code)) throw new ConflictError(`Valor "${value.label}" repetido na lista.`);
    suffixes.add(suffix);
    codes.add(code);
  }
}

async function deleteRemovedValues(tx: Tx, attributeId: string, values: AttributeBody['values']) {
  const keptIds = new Set(
    values.flatMap((v) => (v.attribute_value_id ? [v.attribute_value_id] : []))
  );
  const existing = await tx.attributeValue.findMany({ where: { attribute_id: attributeId } });
  const unknown = [...keptIds].filter((id) => !existing.some((e) => e.attribute_value_id === id));
  if (unknown.length > 0) throw new NotFoundError('Valor não encontrado neste atributo.');

  const removed = existing.filter((value) => !keptIds.has(value.attribute_value_id));
  if (removed.length === 0) return;
  const removedIds = removed.map((value) => value.attribute_value_id);
  const inUse = await tx.skuAttributeValue.groupBy({
    by: ['attribute_value_id'],
    where: { attribute_value_id: { in: removedIds } },
    _count: true,
  });
  const used = inUse[0];
  if (used) {
    const label = removed.find((r) => r.attribute_value_id === used.attribute_value_id)?.label;
    throw new ConflictError(
      `"${label}" está em uso por ${used._count} SKU(s). Desative em vez de excluir.`
    );
  }
  await tx.attributeValue.deleteMany({ where: { attribute_value_id: { in: removedIds } } });
}

/**
 * Grava a lista de valores na ordem recebida: atualiza os existentes, cria os novos e exclui os
 * removidos (se nenhum SKU os usa). Os existentes passam antes por um sufixo temporário, para
 * trocar o código de dois valores entre si não bater no índice único.
 */
async function syncValues(tx: Tx, attributeId: string, values: AttributeBody['values']) {
  assertUniqueValues(values);
  await deleteRemovedValues(tx, attributeId, values);

  for (const [index, value] of values.entries()) {
    if (!value.attribute_value_id) continue;
    await tx.attributeValue.update({
      where: { attribute_value_id: value.attribute_value_id },
      data: { sku_suffix: `~${index}` },
    });
  }
  for (const [position, value] of values.entries()) {
    const data = {
      label: value.label,
      sku_suffix: value.sku_suffix.toUpperCase(),
      color_hex: value.color_hex,
      is_active: value.is_active,
      position,
    };
    if (value.attribute_value_id) {
      await tx.attributeValue.update({
        where: { attribute_value_id: value.attribute_value_id },
        data,
      });
    } else {
      await tx.attributeValue.create({
        data: { ...data, attribute_id: attributeId, code: slugCode(value.label) },
      });
    }
  }
}

export async function createAttribute(
  actorId: string,
  body: AttributeCreateBody
): Promise<Attribute> {
  return prisma.$transaction(async (tx) => {
    const code = (body.code ?? slugCode(body.name)).replace(/-/g, '_');
    if (await tx.attribute.findUnique({ where: { code } })) {
      throw new ConflictError(`Já existe um atributo "${code}".`);
    }
    const last = await tx.attribute.aggregate({ _max: { position: true } });
    const created = await tx.attribute.create({
      data: {
        code,
        name: body.name,
        is_active: body.is_active,
        position: (last._max.position ?? -1) + 1,
      },
    });
    await syncValues(tx, created.attribute_id, body.values);
    const after = await loadAttribute(tx, created.attribute_id);
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'attribute',
      entityId: created.attribute_id,
      action: 'create',
      after,
    });
    return after;
  });
}

export async function updateAttribute(
  actorId: string,
  attributeId: string,
  body: AttributeBody
): Promise<Attribute> {
  return prisma.$transaction(async (tx) => {
    if (!(await tx.attribute.findUnique({ where: { attribute_id: attributeId } }))) {
      throw new NotFoundError('Atributo não encontrado.');
    }
    const before = await loadAttribute(tx, attributeId);
    await tx.attribute.update({
      where: { attribute_id: attributeId },
      data: { name: body.name, is_active: body.is_active },
    });
    await syncValues(tx, attributeId, body.values);
    const after = await loadAttribute(tx, attributeId);
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'attribute',
      entityId: attributeId,
      action: 'update',
      before,
      after,
    });
    return after;
  });
}

export async function createAttributeValue(
  actorId: string,
  attributeId: string,
  body: AttributeValueBody
): Promise<AttributeValue> {
  return prisma.$transaction(async (tx) => {
    const attribute = await tx.attribute.findUnique({ where: { attribute_id: attributeId } });
    if (!attribute) throw new NotFoundError('Atributo não encontrado.');

    const code = body.code ?? slugCode(body.label);
    const existing = await tx.attributeValue.findUnique({
      where: { attribute_id_code: { attribute_id: attributeId, code } },
    });
    if (existing) throw new ConflictError(`${attribute.name} "${existing.label}" já existe.`);

    const suffix = (body.sku_suffix ?? suffixFor(attribute.code, body.label)).toUpperCase();
    const suffixTaken = await tx.attributeValue.findFirst({
      where: { attribute_id: attributeId, sku_suffix: suffix },
    });
    if (suffixTaken) {
      throw new ConflictError(`O sufixo "${suffix}" já é de ${suffixTaken.label} neste atributo.`);
    }

    const last = await tx.attributeValue.aggregate({
      where: { attribute_id: attributeId },
      _max: { position: true },
    });
    const created = await tx.attributeValue.create({
      data: {
        attribute_id: attributeId,
        code,
        label: body.label,
        sku_suffix: suffix,
        color_hex: body.color_hex,
        position: (last._max.position ?? -1) + 1,
      },
      select: valueSelect,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'attribute_value',
      entityId: created.attribute_value_id,
      action: 'create',
      after: { ...created, attribute: attribute.code },
    });
    return created;
  });
}

export async function getCategoryAttributes(categoryId: string): Promise<CategoryAttribute[]> {
  const category = await prisma.category.findUnique({ where: { category_id: categoryId } });
  if (!category) throw new NotFoundError('Categoria não encontrada.');
  return categoryAttributeRules(prisma, categoryId);
}

/** Define os atributos próprios da categoria (os herdados da mãe não entram aqui). */
export async function setCategoryAttributes(
  actorId: string,
  categoryId: string,
  body: CategoryAttributesBody
): Promise<CategoryAttribute[]> {
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { category_id: categoryId } });
    if (!category) throw new NotFoundError('Categoria não encontrada.');

    const found = await tx.attribute.count({
      where: { attribute_id: { in: body.attributes.map((a) => a.attribute_id) } },
    });
    if (found !== new Set(body.attributes.map((a) => a.attribute_id)).size) {
      throw new NotFoundError('Atributo não encontrado.');
    }

    const before = await tx.categoryAttribute.findMany({ where: { category_id: categoryId } });
    await tx.categoryAttribute.deleteMany({ where: { category_id: categoryId } });
    if (body.attributes.length > 0) {
      await tx.categoryAttribute.createMany({
        data: body.attributes.map((item, position) => ({
          category_id: categoryId,
          attribute_id: item.attribute_id,
          is_required: item.is_required,
          position,
        })),
      });
    }
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'category_attributes',
      entityId: categoryId,
      action: 'update',
      before: {
        attributes: before.map((b) => ({
          attribute_id: b.attribute_id,
          is_required: b.is_required,
        })),
      },
      after: { attributes: body.attributes },
    });
  });
  return categoryAttributeRules(prisma, categoryId);
}
