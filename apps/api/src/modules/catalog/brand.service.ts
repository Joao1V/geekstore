import { prisma } from '@geekstore/db';
import type { Brand, BrandBody, BrandUpdateBody } from '@geekstore/shared';

import { ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';

const MAX_SLUG_LENGTH = 140;

function slugOf(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

type BrandRow = {
  brand_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  _count: { products: number };
};

const toBrand = (row: BrandRow): Brand => ({
  brand_id: row.brand_id,
  name: row.name,
  slug: row.slug,
  is_active: row.is_active,
  product_count: row._count.products,
});

const countProducts = { _count: { select: { products: true } } } as const;

export async function listBrands(): Promise<Brand[]> {
  const rows = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: countProducts,
  });
  return rows.map(toBrand);
}

/** "Funko" e "FUNKO" são a mesma marca: a unicidade vale para o endereço (slug), não só para o texto. */
async function assertNameFree(name: string, exceptId?: string): Promise<string> {
  const slug = slugOf(name);
  if (!slug) throw new ConflictError('O nome precisa ter letras ou números.');
  const taken = await prisma.brand.findFirst({
    where: { OR: [{ slug }, { name }], ...(exceptId ? { NOT: { brand_id: exceptId } } : {}) },
  });
  if (taken) throw new ConflictError(`A marca "${taken.name}" já existe.`);
  return slug;
}

export async function createBrand(actorId: string, body: BrandBody): Promise<Brand> {
  const slug = await assertNameFree(body.name);
  return prisma.$transaction(async (tx) => {
    const created = await tx.brand.create({
      data: { name: body.name, slug },
      include: countProducts,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'brand',
      entityId: created.brand_id,
      action: 'create',
      after: { brand_id: created.brand_id, name: created.name, slug: created.slug },
    });
    return toBrand(created);
  });
}

export async function updateBrand(
  actorId: string,
  brandId: string,
  body: BrandUpdateBody
): Promise<Brand> {
  const before = await prisma.brand.findUnique({ where: { brand_id: brandId } });
  if (!before) throw new NotFoundError('Marca não encontrada.');
  const slug = body.name !== undefined ? await assertNameFree(body.name, brandId) : undefined;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.brand.update({
      where: { brand_id: brandId },
      data: { ...body, ...(slug ? { slug } : {}) },
      include: countProducts,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'brand',
      entityId: brandId,
      action: 'update',
      before: { name: before.name, slug: before.slug, is_active: before.is_active },
      after: { name: updated.name, slug: updated.slug, is_active: updated.is_active },
    });
    return toBrand(updated);
  });
}
