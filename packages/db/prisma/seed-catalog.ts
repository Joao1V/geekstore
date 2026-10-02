// Mock de catálogo com dados reais (ver `seed-data/types.ts`): `pnpm --filter @geekstore/db seed:catalog`.
// Idempotente e opcional: não faz parte do `seed` padrão, que só cria o admin.
import { ensureAttributeCatalog, prisma, suffixFor, valueCodeOf } from '../src/index';
import { categories, collections, products, type SeedProduct } from './seed-data';

const SEED_MOVEMENT_REASON = 'Estoque inicial (seed)';
const COST_RATIO = 0.6;
const DEFAULT_WEIGHT_G = 300;

type Context = {
  categoryIds: Map<string, string>;
  collectionIds: Map<string, string>;
  siteChannelId: string;
  warehouseId: string;
};

async function seedCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const [position, category] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        slug: category.slug,
        name: category.name,
        parent_id: category.parent ? (idBySlug.get(category.parent) ?? null) : null,
        featured: category.featured ?? false,
        position,
      },
    });
    idBySlug.set(category.slug, row.category_id);
  }
  return idBySlug;
}

async function seedCollections(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const [position, collection] of collections.entries()) {
    const row = await prisma.collection.upsert({
      where: { slug: collection.slug },
      update: {},
      create: {
        slug: collection.slug,
        name: collection.name,
        kind: collection.kind,
        description: collection.description ?? null,
        featured: collection.featured ?? false,
        position,
      },
    });
    idBySlug.set(collection.slug, row.collection_id);
  }
  return idBySlug;
}

/** Estoque inicial determinístico por código: ~8% esgotado, ~17% baixo, o resto folgado. */
function defaultStock(code: string): number {
  const bucket = [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;
  if (bucket < 8) return 0;
  if (bucket < 25) return (bucket % 4) + 1;
  return 5 + (bucket % 26);
}

function renderDescription(seed: SeedProduct): string {
  const { specs } = seed;
  if (!specs) return seed.description;
  const lines = [
    specs.players && `Jogadores: ${specs.players}`,
    specs.age && `Idade: ${specs.age}`,
    specs.minutes && `Duração: ${specs.minutes} min`,
    specs.pieces && `Peças: ${specs.pieces}`,
  ].filter(Boolean);
  return lines.length > 0
    ? `${seed.description}\n\nFicha técnica\n${lines.join('\n')}`
    : seed.description;
}

async function seedMedia(productId: string, seed: SeedProduct): Promise<void> {
  if (!seed.images || seed.images.length === 0) return;
  if ((await prisma.media.count({ where: { product_id: productId } })) > 0) return;
  await prisma.media.createMany({
    data: seed.images.map((url, position) => ({
      product_id: productId,
      url,
      alt: `${seed.name} (foto ${position + 1})`,
      position,
    })),
  });
}

async function seedPrice(skuId: string, priceCents: number, ctx: Context): Promise<void> {
  const existing = await prisma.price.findFirst({
    where: { sku_id: skuId, channel_id: ctx.siteChannelId },
  });
  if (existing) return;
  await prisma.price.create({
    data: { sku_id: skuId, channel_id: ctx.siteChannelId, price_cents: priceCents },
  });
}

/** Saldo inicial sempre com a movimentação de entrada correspondente (livro-razão consistente). */
async function seedStock(skuId: string, quantity: number, ctx: Context): Promise<void> {
  const existing = await prisma.stockLevel.findUnique({
    where: { sku_id_location_id: { sku_id: skuId, location_id: ctx.warehouseId } },
  });
  if (existing) return;

  await prisma.$transaction([
    prisma.stockLevel.create({
      data: { sku_id: skuId, location_id: ctx.warehouseId, on_hand: quantity },
    }),
    ...(quantity > 0
      ? [
          prisma.stockMovement.create({
            data: {
              sku_id: skuId,
              location_id: ctx.warehouseId,
              type: 'inbound',
              quantity,
              reason: SEED_MOVEMENT_REASON,
            },
          }),
        ]
      : []),
  ]);
}

async function seedProduct(seed: SeedProduct, ctx: Context): Promise<void> {
  const categoryId = ctx.categoryIds.get(seed.category);
  if (!categoryId) throw new Error(`Categoria inexistente no seed: ${seed.category}`);

  const product = await prisma.product.upsert({
    where: { slug: seed.slug },
    update: {},
    create: {
      code: seed.skus[0]?.code ?? seed.slug.toUpperCase().slice(0, 40),
      slug: seed.slug,
      name: seed.name,
      brand: seed.brand,
      description: renderDescription(seed),
      category_id: categoryId,
      status: seed.status ?? 'active',
    },
  });

  for (const sku of seed.skus) {
    const row = await prisma.sku.upsert({
      where: { code: sku.code },
      update: {},
      create: {
        product_id: product.product_id,
        code: sku.code,
        ean: sku.ean ?? null,
        weight_g: sku.weight_g ?? DEFAULT_WEIGHT_G,
        cost_cents: Math.round(sku.price_cents * COST_RATIO),
      },
    });
    await seedAttributes(row.sku_id, sku.attributes);
    await seedPrice(row.sku_id, sku.price_cents, ctx);
    await seedStock(row.sku_id, sku.stock ?? defaultStock(sku.code), ctx);
  }

  await seedMedia(product.product_id, seed);

  const links = seed.collections.map((slug, position) => {
    const collectionId = ctx.collectionIds.get(slug);
    if (!collectionId) throw new Error(`Coleção inexistente no seed: ${slug}`);
    return { collection_id: collectionId, product_id: product.product_id, position };
  });
  await prisma.collectionProduct.createMany({ data: links, skipDuplicates: true });
}

async function main(): Promise<void> {
  const [categoryIds, collectionIds, siteChannel, warehouse] = await Promise.all([
    seedCategories(),
    seedCollections(),
    prisma.channel.findUniqueOrThrow({ where: { code: 'site' } }),
    prisma.location.findFirstOrThrow({
      where: { type: 'warehouse' },
      orderBy: { created_at: 'asc' },
    }),
  ]);
  const ctx: Context = {
    categoryIds,
    collectionIds,
    siteChannelId: siteChannel.channel_id,
    warehouseId: warehouse.location_id,
  };

  for (const product of products) await seedProduct(product, ctx);

  const skuCount = products.reduce((sum, product) => sum + product.skus.length, 0);
  console.log(
    `Catálogo pronto: ${categories.length} categorias, ${collections.length} coleções, ${products.length} produtos, ${skuCount} SKUs.`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/** `{ tamanho: 'M' }` -> liga o SKU ao valor cadastrado (cria o valor se ainda não existir). */
async function seedAttributes(skuId: string, attributes: Record<string, string>) {
  await ensureAttributeCatalog(prisma);
  for (const [code, label] of Object.entries(attributes)) {
    const attribute = await prisma.attribute.findUnique({ where: { code } });
    if (!attribute) continue;
    const value = await prisma.attributeValue.upsert({
      where: {
        attribute_id_code: { attribute_id: attribute.attribute_id, code: valueCodeOf(label) },
      },
      update: {},
      create: {
        attribute_id: attribute.attribute_id,
        code: valueCodeOf(label),
        label,
        sku_suffix: suffixFor(code, label),
      },
    });
    await prisma.skuAttributeValue.upsert({
      where: { sku_id_attribute_id: { sku_id: skuId, attribute_id: attribute.attribute_id } },
      update: { attribute_value_id: value.attribute_value_id },
      create: {
        sku_id: skuId,
        attribute_id: attribute.attribute_id,
        attribute_value_id: value.attribute_value_id,
      },
    });
  }
}
