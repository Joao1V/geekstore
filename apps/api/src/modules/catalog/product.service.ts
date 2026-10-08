import { type Prisma, prisma } from '@geekstore/db';
import {
  type Paginated,
  type ProductBody,
  type ProductDetail,
  type ProductListItem,
  type ProductListQuery,
  type ProductMoveBody,
  type ProductUpdateBody,
  productSortFields,
} from '@geekstore/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog, writeAuditLogs } from '../../core/audit';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';
import { allocateProductCode, skuSuffix, withSuffix } from './auto-codes';
import { toProductDetail, toProductListItem, toSku } from './catalog.mappers';
import { categoryScope } from './category.service';
import { findProductIds, needsSqlQuery } from './product-list-query';
import { EMPTY_STATS, loadListStats } from './product-list-stats';
import { replaceSkuAttributes, resolveAttributes, skuAttributeInclude } from './sku-attributes';
import { applyInitialValues, loadInitialContext } from './sku-initial';

const detailInclude = {
  skus: { orderBy: { code: 'asc' }, include: skuAttributeInclude },
  brand: { select: { name: true, logo_url: true } },
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

function buildWhere(query: ProductListQuery, categoryIds?: string[]): Prisma.ProductWhereInput {
  const { status } = query;
  return {
    ...(status ? { status } : {}),
    ...(categoryIds ? { category_id: { in: categoryIds } } : {}),
  };
}

async function listWithPrisma(
  query: ProductListQuery,
  sort: ListSort,
  window: ListWindow,
  categoryIds?: string[]
) {
  const where = buildWhere(query, categoryIds);
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
async function listWithSql(
  query: ProductListQuery,
  sort: ListSort,
  window: ListWindow,
  categoryIds?: string[]
) {
  const { ids, total } = await findProductIds(query, sort, window, categoryIds);
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

  // Filtrar uma categoria inclui as subcategorias (a categoria é uma "pasta").
  const categoryIds = query.category_id ? await categoryScope(query.category_id) : undefined;
  const { rows, total } = needsSqlQuery(query)
    ? await listWithSql(query, sort, window, categoryIds)
    : await listWithPrisma(query, sort, window, categoryIds);
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
  const { skus, code: givenCode, ...productData } = body;

  return prisma.$transaction(async (tx) => {
    await assertCategoryExists(tx, productData.category_id);
    await assertSlugAvailable(tx, productData.slug);
    // Sem código informado, o servidor numera: produto TIPO-NNNNN e SKUs com o sufixo das variações.
    const suffixes = await Promise.all(skus.map((sku) => skuSuffix(tx, sku.attributes)));
    const code = givenCode ?? (await allocateProductCode(tx, productData.category_id, suffixes));
    const skuCodes = skus.map((sku, index) => sku.code ?? withSuffix(code, suffixes[index] ?? ''));
    await assertProductCodeAvailable(tx, code);
    await assertSkuCodesAvailable(tx, skuCodes);

    const resolvedBySku = await Promise.all(
      skus.map((sku) => resolveAttributes(tx, productData.category_id, sku.attributes))
    );
    const product = await tx.product.create({ data: { ...productData, code } });
    const initialContext = await loadInitialContext(tx);
    for (const [index, sku] of skus.entries()) {
      const { attributes: _attributes, price_cents, initial_stock, code: _code, ...fields } = sku;
      const row = await tx.sku.create({
        data: { ...fields, code: skuCodes[index] as string, product_id: product.product_id },
      });
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

const MAX_MOVE_FILTER = 20_000;
const MOVE_CHUNK = 2_000;

/**
 * Move produtos para outra categoria, de uma vez e com auditoria de cada um (antes e depois). Vale
 * para os produtos escolhidos ou para tudo o que um filtro da lista mostra (até 20 mil). Tudo ou nada.
 */
export async function moveProducts(
  actorId: string,
  body: ProductMoveBody
): Promise<{ moved: number }> {
  const target = await prisma.category.findUnique({ where: { category_id: body.category_id } });
  if (!target) throw new NotFoundError('Categoria de destino não encontrada.');

  const ids = body.product_ids ?? (await idsMatchingFilter(body.filter ?? {}));
  if (ids.length === 0) return { moved: 0 };

  return prisma.$transaction(
    async (tx) => {
      const before = await tx.product.findMany({
        where: { product_id: { in: ids }, NOT: { category_id: target.category_id } },
        select: { product_id: true, category_id: true },
      });
      for (let start = 0; start < before.length; start += MOVE_CHUNK) {
        const chunk = before.slice(start, start + MOVE_CHUNK).map((row) => row.product_id);
        await tx.product.updateMany({
          where: { product_id: { in: chunk } },
          data: { category_id: target.category_id },
        });
      }
      await writeAuditLogs(
        tx,
        before.map((row) => ({
          userId: actorId,
          entity: 'product',
          entityId: row.product_id,
          action: 'update' as const,
          before: { category_id: row.category_id },
          after: { category_id: target.category_id },
        }))
      );
      return { moved: before.length };
    },
    { timeout: 60_000 }
  );
}

async function idsMatchingFilter(
  filter: NonNullable<ProductMoveBody['filter']>
): Promise<string[]> {
  const categoryIds = filter.category_id ? await categoryScope(filter.category_id) : undefined;
  const query = { ...filter, page: 1, page_size: MAX_MOVE_FILTER } as ProductListQuery;
  const { ids, total } = await findProductIds(
    query,
    { field: 'created_at', direction: 'desc' },
    { skip: 0, take: MAX_MOVE_FILTER },
    categoryIds
  );
  if (total > MAX_MOVE_FILTER) {
    throw new BadRequestError(
      `O filtro tem ${total} produtos (o máximo por vez é ${MAX_MOVE_FILTER}). Refine o filtro.`
    );
  }
  return ids;
}
