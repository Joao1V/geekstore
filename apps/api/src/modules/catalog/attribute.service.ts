import { prisma } from '@geekstore/db';
import type {
  Attribute,
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
  position: true,
  color_hex: true,
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
  return rows.map(({ attribute_id, code, name, position, values }) => ({
    attribute_id,
    code,
    name,
    position,
    values,
  }));
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

    const last = await tx.attributeValue.aggregate({
      where: { attribute_id: attributeId },
      _max: { position: true },
    });
    const created = await tx.attributeValue.create({
      data: {
        attribute_id: attributeId,
        code,
        label: body.label,
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
