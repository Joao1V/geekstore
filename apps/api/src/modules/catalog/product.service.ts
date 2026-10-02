import { type Prisma, prisma } from '@geekstore/db';
import {
  type Paginated,
  type ProductBody,
  type ProductDetail,
  type ProductListItem,
  type ProductListQuery,
  type ProductUpdateBody,
  productSortFields,
} from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';
import { toProductDetail, toProductListItem, toSku } from './catalog.mappers';
import { findProductIds, needsSqlQuery } from './product-list-query';
import { EMPTY_STATS, loadListStats } from './product-list-stats';
import { replaceSkuAttributes, resolveAttributes, skuAttributeInclude } from './sku-attributes';
import { applyInitialValues, loadInitialContext } from './sku-initial';

const detailInclude = {
  skus: { orderBy: { code: 'asc' }, include: skuAttributeInclude },
  brand: { select: { name: true } },
  media: { orderBy: [{ position: 'asc' }, { created_at: 'asc' }] },
  collection_products: { select: { collection_id: true } },
} satisfies Prisma.ProductInclude;

// Só a primeira foto de cada produto (por posição): é a miniatura da listagem.
const thumbnailInclude = {
  brand: { select: { name: true } },
  media: { orderBy: [{ position: 'asc' }, { created_at: 'asc' }], take: 1, select: { url: true } },
} satisfies Prisma.ProductInclude;

type ListRow = Prisma.ProductGetPayload<{ include: typeof thumbnailInclude }>;
type ListSort = Parameters<typeof findProductIds>[1];
type ListWindow = Parameters<typeof findProductIds>[2];

function buildWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const { status, category_id } = query;
  return {
    ...(status ? { status } : {}),
    ...(category_id ? { category_id } : {}),
  };
}

async function listWithPrisma(query: ProductListQuery, sort: ListSort, window: ListWindow) {
  const where = buildWhere(query);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ [sort.field]: sort.direction }, { product_id: 'asc' }],
      include: thumbnailInclude,
      ...window,
    }),
    prisma.product.count({ where }),
  ]);
  return { rows, total };
}

/** Com busca ou atalho a ordem e a janela vêm do SQL; as linhas seguem a ordem dos ids. */
async function listWithSql(query: ProductListQuery, sort: ListSort, window: ListWindow) {
  const { ids, total } = await findProductIds(query, sort, window);
  const found = await prisma.product.findMany({
    where: { product_id: { in: ids } },
    include: thumbnailInclude,
  });
  const byId = new Map(found.map((row) => [row.product_id, row]));
  return { rows: ids.flatMap((id) => byId.get(id) ?? []) as ListRow[], total };
}

export async function listProducts(query: ProductListQuery): Promise<Paginated<ProductListItem>> {
  const { field, direction } = parseSort(query.sort, productSortFields, {
    field: 'created_at',
    direction: 'desc',
  });
  const sort = { field, direction };
  const window = skipTake(query.page, query.page_size);

  const { rows, total } = needsSqlQuery(query)
    ? await listWithSql(query, sort, window)
    : await listWithPrisma(query, sort, window);
  const stats = await loadListStats(rows.map((row) => row.product_id));

  return {
    data: rows.map((row) => toProductListItem(row, stats.get(row.product_id) ?? EMPTY_STATS)),
    meta: buildMeta(query.page, query.page_size, total),
  };
}

export async function getProductDetail(productId: string): Promise<ProductDetail> {
  const row = await prisma.product.findUnique({
    where: { product_id: productId },
    include: detailInclude,
  });
  if (!row) throw new NotFoundError('Produto não encontrado.');
  return toProductDetail(row);
}

async function assertCategoryExists(tx: Prisma.TransactionClient, categoryId: string) {
  const category = await tx.category.findUnique({ where: { category_id: categoryId } });
  if (!category) throw new BadRequestError('Categoria não encontrada.');
}

async function assertProductCodeAvailable(tx: Prisma.TransactionClient, code: string) {
  if (await tx.product.findUnique({ where: { code } })) {
    throw new ConflictError(`Já existe um produto com o código ${code}.`);
  }
}

async function assertSlugAvailable(tx: Prisma.TransactionClient, slug: string, exceptId?: string) {
  const existing = await tx.product.findUnique({ where: { slug } });
  if (existing && existing.product_id !== exceptId) {
    throw new ConflictError('Já existe um produto com esse slug.');
  }
}

export async function assertSkuCodesAvailable(
  tx: Prisma.TransactionClient,
  codes: readonly string[]
): Promise<void> {
  if (new Set(codes).size !== codes.length) {
    throw new BadRequestError('Códigos de SKU repetidos na mesma requisição.');
  }
  const taken = await tx.sku.findMany({
    where: { code: { in: [...codes] } },
    select: { code: true },
  });
  if (taken.length > 0) {
    throw new ConflictError(`Código de SKU já em uso: ${taken.map((sku) => sku.code).join(', ')}.`);
  }
}

/** Cria produto + SKUs numa só transação (RF-CAT-04), com auditoria de cada entidade. */
export async function createProduct(actorId: string, body: ProductBody): Promise<ProductDetail> {
  const { skus, ...productData } = body;

  return prisma.$transaction(async (tx) => {
    await assertCategoryExists(tx, productData.category_id);
    await assertSlugAvailable(tx, productData.slug);
    await assertProductCodeAvailable(tx, productData.code);
    await assertSkuCodesAvailable(
      tx,
      skus.map((sku) => sku.code)
    );

    const resolvedBySku = await Promise.all(
      skus.map((sku) => resolveAttributes(tx, productData.category_id, sku.attributes))
    );
    const product = await tx.product.create({ data: productData });
    const initialContext = await loadInitialContext(tx);
    for (const [index, sku] of skus.entries()) {
      const { attributes: _attributes, price_cents, initial_stock, ...fields } = sku;
      const row = await tx.sku.create({ data: { ...fields, product_id: product.product_id } });
      await replaceSkuAttributes(tx, row.sku_id, resolvedBySku[index] ?? []);
      await applyInitialValues(
        tx,
        actorId,
        row.sku_id,
        { price_cents, initial_stock },
        initialContext
      );
    }
    const created = await tx.product.findUniqueOrThrow({
      where: { product_id: product.product_id },
      include: detailInclude,
    });

    const {
      skus: createdSkus,
      media: _media,
      collection_products: _links,
      ...productRow
    } = created;
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'product',
      entityId: created.product_id,
      action: 'create',
      after: productRow,
    });
    for (const sku of createdSkus) {
      await writeAuditLog(tx, {
        userId: actorId,
        entity: 'sku',
        entityId: sku.sku_id,
        action: 'create',
        after: { ...sku, attribute_values: undefined, attributes: toSku(sku).attributes },
      });
    }
    return toProductDetail(created);
  });
}

export async function updateProduct(
  actorId: string,
  productId: string,
  body: ProductUpdateBody
): Promise<ProductDetail> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { product_id: productId } });
    if (!before) throw new NotFoundError('Produto não encontrado.');

    if (body.category_id !== undefined) await assertCategoryExists(tx, body.category_id);
    if (body.slug !== undefined) await assertSlugAvailable(tx, body.slug, productId);

    const updated = await tx.product.update({
      where: { product_id: productId },
      data: body,
      include: detailInclude,
    });

    const { skus: _skus, media: _media, collection_products: _links, ...after } = updated;
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'product',
      entityId: productId,
      action: 'update',
      before,
      after,
    });
    return toProductDetail(updated);
  });
}

/** `DELETE` de produto = arquivar (RF-CAT-01): o histórico de pedidos e SKUs continua íntegro. */
export async function archiveProduct(actorId: string, productId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { product_id: productId } });
    if (!before) throw new NotFoundError('Produto não encontrado.');
    if (before.status === 'archived') return;

    const after = await tx.product.update({
      where: { product_id: productId },
      data: { status: 'archived' },
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: 'product',
      entityId: productId,
      action: 'update',
      before,
      after,
    });
  });
}
