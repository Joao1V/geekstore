import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { RoleCode } from '@geekstore/shared';

import { hashPassword } from '../core/security/password';

/** Fixtures de testes de integração: nomes únicos por execução e limpeza completa no final. */
export type CatalogFixture = {
  suffix: string;
  userId: string;
  categoryId: string;
  productId: string;
  skuId: string;
  skuCode: string;
  locationId: string;
  cleanup: () => Promise<void>;
};

export async function createUser(role: RoleCode, suffix = randomUUID().slice(0, 8)) {
  const roleRow = await prisma.role.findUniqueOrThrow({ where: { code: role } });
  return prisma.user.create({
    data: {
      email: `it-${role}-${suffix}@geekstore.local`,
      name: `IT ${role} ${suffix}`,
      password_hash: await hashPassword('senha-teste-123'),
      role_id: roleRow.role_id,
    },
  });
}

export async function findWarehouseId(): Promise<string> {
  const location = await prisma.location.findFirstOrThrow({ where: { type: 'warehouse' } });
  return location.location_id;
}

export async function createCatalogFixture(): Promise<CatalogFixture> {
  const suffix = randomUUID().slice(0, 8);
  const user = await createUser('owner', suffix);
  const category = await prisma.category.create({
    data: { name: `IT Cat ${suffix}`, slug: `it-cat-${suffix}` },
  });
  const skuCode = `IT-${suffix.toUpperCase()}`;
  const product = await prisma.product.create({
    data: {
      name: `IT Produto ${suffix}`,
      slug: `it-produto-${suffix}`,
      category_id: category.category_id,
      status: 'active',
      skus: { create: [{ code: skuCode }] },
    },
    include: { skus: true },
  });
  const sku = product.skus[0];
  if (!sku) throw new Error('fixture sem SKU');

  return {
    suffix,
    userId: user.user_id,
    categoryId: category.category_id,
    productId: product.product_id,
    skuId: sku.sku_id,
    skuCode,
    locationId: await findWarehouseId(),
    cleanup: () => cleanupCatalog({ userId: user.user_id, categoryId: category.category_id }),
  };
}

/** Apaga tudo o que os testes criaram sob a categoria e o usuário da fixture (ordem das FKs). */
export async function cleanupCatalog(ids: { userId: string; categoryId: string }) {
  const products = await prisma.product.findMany({
    where: { category_id: ids.categoryId },
    include: { skus: true },
  });
  const skuIds = products.flatMap((product) => product.skus.map((sku) => sku.sku_id));
  const productIds = products.map((product) => product.product_id);
  const entityIds = [...skuIds, ...productIds, ids.categoryId];

  await prisma.stockMovement.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.stockLevel.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.price.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.media.deleteMany({ where: { product_id: { in: productIds } } });
  await prisma.sku.deleteMany({ where: { sku_id: { in: skuIds } } });
  await prisma.product.deleteMany({ where: { product_id: { in: productIds } } });
  const children = await prisma.category.findMany({
    where: { parent_id: ids.categoryId },
    select: { category_id: true },
  });
  await prisma.categoryAttribute.deleteMany({
    where: { category_id: { in: [ids.categoryId, ...children.map((c) => c.category_id)] } },
  });
  await prisma.category.deleteMany({ where: { parent_id: ids.categoryId } });
  await prisma.category.deleteMany({ where: { category_id: ids.categoryId } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entity_id: { in: entityIds } }, { user_id: ids.userId }] },
  });
  await prisma.user.deleteMany({ where: { user_id: ids.userId } });
}
