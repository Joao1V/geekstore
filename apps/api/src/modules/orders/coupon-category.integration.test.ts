import { randomUUID } from 'node:crypto';
import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';

describe('coupons restricted to categories (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let owner: string;
  let otherSkuId = '';
  let childSkuId = '';
  let otherCategoryId = '';
  let childCategoryId = '';
  const run = randomUUID().slice(0, 6).toUpperCase();
  const codes: string[] = [];
  const code = (suffix: string) => {
    const value = `CC${run}${suffix}`;
    codes.push(value);
    return value;
  };

  /** Cria categoria + produto + SKU à venda por `price` centavos. */
  const sellable = async (name: string, parentId: string | null, price: number) => {
    const category = await prisma.category.create({
      data: {
        name: `${name} ${run}`,
        slug: `cc-${name.toLowerCase()}-${run}`,
        parent_id: parentId,
      },
    });
    const product = await prisma.product.create({
      data: {
        category_id: category.category_id,
        code: `CC-${name.toUpperCase()}-${run}`,
        name: `${name} ${run}`,
        slug: `cc-prod-${name.toLowerCase()}-${run}`,
        status: 'active',
        skus: { create: [{ code: `CC-${name.toUpperCase()}-${run}-1` }] },
      },
      include: { skus: true },
    });
    const channel = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    const sku = product.skus[0];
    if (!sku) throw new Error('sem SKU');
    await prisma.price.create({
      data: {
        sku_id: sku.sku_id,
        channel_id: channel.channel_id,
        price_cents: price,
        starts_at: new Date(Date.now() - 60_000),
      },
    });
    return { categoryId: category.category_id, skuId: sku.sku_id };
  };

  const check = (couponCode: string, items: { sku_id: string; quantity: number }[]) =>
    app.inject({
      method: 'POST',
      url: '/api/store/coupons/check',
      payload: { code: couponCode, items },
    });
  const coupon = (suffix: string, data: object) =>
    prisma.coupon.create({
      data: { code: code(suffix), kind: 'percent', value: 50, ...data },
    });

  beforeAll(async () => {
    app = await buildTestApp();
    fx = await createCatalogFixture();
    const channel = await prisma.channel.findUniqueOrThrow({ where: { code: 'site' } });
    await prisma.price.create({
      data: {
        sku_id: fx.skuId,
        channel_id: channel.channel_id,
        price_cents: 5_000,
        starts_at: new Date(Date.now() - 60_000),
      },
    });
    owner = app.jwt.sign({ sub: fx.userId, role: 'owner' });
    const other = await sellable('Outra', null, 3_000);
    otherSkuId = other.skuId;
    otherCategoryId = other.categoryId;
    const child = await sellable('Filha', fx.categoryId, 2_000);
    childSkuId = child.skuId;
    childCategoryId = child.categoryId;
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { in: codes } } });
    for (const skuId of [otherSkuId, childSkuId]) {
      await prisma.price.deleteMany({ where: { sku_id: skuId } });
    }
    await prisma.price.deleteMany({ where: { sku_id: fx.skuId } });
    await prisma.sku.deleteMany({ where: { code: { startsWith: 'CC-' } } });
    await prisma.product.deleteMany({ where: { code: { startsWith: 'CC-' } } });
    await prisma.category.deleteMany({
      where: { category_id: { in: [childCategoryId, otherCategoryId] } },
    });
    await prisma.auditLog.deleteMany({ where: { user_id: fx.userId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('a coupon without categories discounts the whole cart', async () => {
    await coupon('ALL', {});
    const response = await check(code('ALL'), [
      { sku_id: fx.skuId, quantity: 1 },
      { sku_id: otherSkuId, quantity: 1 },
    ]);
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      discount_cents: 4_000,
      eligible_subtotal_cents: 8_000,
    });
  });

  it('with categories, the discount counts only the items of those categories', async () => {
    const restricted = await coupon('CAT', {});
    await prisma.couponCategory.create({
      data: { coupon_id: restricted.coupon_id, category_id: fx.categoryId },
    });
    const response = await check(code('CAT'), [
      { sku_id: fx.skuId, quantity: 1 },
      { sku_id: otherSkuId, quantity: 1 },
    ]);
    expect(response.json().data).toMatchObject({
      discount_cents: 2_500,
      eligible_subtotal_cents: 5_000,
    });
  });

  it('refuses the coupon when the cart has no item of the category, naming it', async () => {
    const response = await check(code('CAT'), [{ sku_id: otherSkuId, quantity: 2 }]);
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('vale só para produtos de');
  });

  it('also covers the subcategories', async () => {
    const response = await check(code('CAT'), [{ sku_id: childSkuId, quantity: 1 }]);
    expect(response.json().data).toMatchObject({
      discount_cents: 1_000,
      eligible_subtotal_cents: 2_000,
    });
  });

  it('the minimum order counts only the eligible items', async () => {
    const min = await coupon('MIN', { min_subtotal_cents: 6_000 });
    await prisma.couponCategory.create({
      data: { coupon_id: min.coupon_id, category_id: fx.categoryId },
    });
    // O carrinho tem R$ 80, mas só R$ 50 são da categoria: abaixo do mínimo de R$ 60.
    const below = await check(code('MIN'), [
      { sku_id: fx.skuId, quantity: 1 },
      { sku_id: otherSkuId, quantity: 1 },
    ]);
    expect(below.statusCode).toBe(400);
    const enough = await check(code('MIN'), [{ sku_id: fx.skuId, quantity: 2 }]);
    expect(enough.statusCode).toBe(200);
  });

  it('free shipping restricted to a category needs one item of it', async () => {
    const free = await coupon('FRE', { kind: 'free_shipping', value: 0 });
    await prisma.couponCategory.create({
      data: { coupon_id: free.coupon_id, category_id: fx.categoryId },
    });
    expect((await check(code('FRE'), [{ sku_id: otherSkuId, quantity: 1 }])).statusCode).toBe(400);
    const ok = await check(code('FRE'), [{ sku_id: fx.skuId, quantity: 1 }]);
    expect(ok.json().data).toMatchObject({ free_shipping: true, discount_cents: 0 });
  });

  it('the admin sets the categories, rejects unknown ones and clears them', async () => {
    const call = (method: 'POST' | 'PATCH', url: string, payload: object) =>
      app.inject({
        method,
        url: `/api/pricing/coupons${url}`,
        payload,
        headers: { authorization: `Bearer ${owner}` },
      });
    const created = await call('POST', '', {
      code: code('ADM'),
      kind: 'percent',
      value: 10,
      category_ids: [fx.categoryId, fx.categoryId],
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.category_ids).toEqual([fx.categoryId]);
    const id = created.json().data.coupon_id as string;

    const bad = await call('PATCH', `/${id}`, {
      category_ids: ['00000000-0000-7000-8000-000000000000'],
    });
    expect(bad.statusCode).toBe(400);

    const cleared = await call('PATCH', `/${id}`, { category_ids: [] });
    expect(cleared.json().data.category_ids).toEqual([]);
    // Sem category_ids no corpo, as categorias ficam como estão.
    await call('PATCH', `/${id}`, { category_ids: [otherCategoryId] });
    const untouched = await call('PATCH', `/${id}`, { value: 15 });
    expect(untouched.json().data.category_ids).toEqual([otherCategoryId]);
  });

  it('a category used by a coupon cannot be deleted (the restriction would silently disappear)', async () => {
    const guarded = await coupon('FK', {});
    await prisma.couponCategory.create({
      data: { coupon_id: guarded.coupon_id, category_id: childCategoryId },
    });
    await expect(
      prisma.category.delete({ where: { category_id: childCategoryId } })
    ).rejects.toThrow();
  });
});
