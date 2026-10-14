import { prisma } from '@geekstore/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp } from '../../test-support/build-test-app';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';

describe('store addresses in the Tray pattern (integration — requires a live DATABASE_URL)', () => {
  let app: FastifyInstance;
  let fx: CatalogFixture;
  let root: string;
  let child: string;
  let childId = '';
  let active: string;
  let draft: string;
  let inChild: string;

  const resolve = async (path: string) =>
    (
      await app.inject({
        method: 'GET',
        url: `/api/store/resolve?path=${encodeURIComponent(path)}`,
      })
    ).json().data;

  beforeAll(async () => {
    app = await buildTestApp();
    fx = await createCatalogFixture();
    root = `it-cat-${fx.suffix}`;
    child = `filha-${fx.suffix}`;
    const category = await prisma.category.create({
      data: { name: `Filha ${fx.suffix}`, slug: child, parent_id: fx.categoryId },
    });
    childId = category.category_id;
    const mk = (suffix: string, status: 'active' | 'draft', categoryId: string) =>
      prisma.product
        .create({
          data: {
            code: `RS-${suffix}-${fx.suffix.toUpperCase()}`,
            name: `Resolve ${suffix}`,
            slug: `rs-${suffix}-${fx.suffix}`,
            category_id: categoryId,
            status,
          },
        })
        .then((product) => product.slug);
    [active, draft, inChild] = await Promise.all([
      mk('ativo', 'active', fx.categoryId),
      mk('rascunho', 'draft', fx.categoryId),
      mk('filho', 'active', childId),
    ]);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { code: { startsWith: 'RS-' } } });
    await prisma.category.delete({ where: { category_id: childId } });
    await fx.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('recognises a category by its chain of slugs, at any depth', async () => {
    expect(await resolve(`/${root}/`)).toEqual({ type: 'category', path: `/${root}/`, slug: root });
    expect(await resolve(`${root}/${child}`)).toEqual({
      type: 'category',
      path: `/${root}/${child}/`,
      slug: child,
    });
  });

  it('recognises a product at category/slug and nested under a subcategory', async () => {
    expect(await resolve(`/${root}/${active}/`)).toEqual({
      type: 'product',
      path: `/${root}/${active}/`,
      slug: active,
    });
    expect((await resolve(`/${root}/${child}/${inChild}/`)).path).toBe(
      `/${root}/${child}/${inChild}/`
    );
  });

  it('answers the canonical address when the category part is wrong (old URL, moved product)', async () => {
    expect((await resolve(`/outra-coisa/${active}/`)).path).toBe(`/${root}/${active}/`);
    expect((await resolve(`/${child}/${inChild}/`)).path).toBe(`/${root}/${child}/${inChild}/`);
    // Só o último slug da categoria: devolve o caminho completo.
    expect(await resolve(`/${child}/`)).toMatchObject({
      type: 'category',
      path: `/${root}/${child}/`,
    });
  });

  it('does not expose a draft product or an unknown address', async () => {
    expect(await resolve(`/${root}/${draft}/`)).toEqual({ type: 'none' });
    expect(await resolve('/nao/existe/mesmo/')).toEqual({ type: 'none' });
    expect(await resolve('/')).toEqual({ type: 'none' });
  });
});
