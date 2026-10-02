import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { getCatalogDashboard } from './catalog-dashboard.service';
import { listProducts } from './product.service';

describe('catalog dashboard (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;

  beforeAll(async () => {
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('counts each pendency with the same rule as the list filter', async () => {
    const dashboard = await getCatalogDashboard();
    for (const issue of [
      'no_photo',
      'out_of_stock',
      'no_price',
      'no_brand',
      'no_description',
      'no_weight',
    ] as const) {
      const listed = await listProducts({ page: 1, page_size: 1, issue });
      // Os testes em paralelo criam e apagam produtos: aceita uma folga pequena, nunca uma conta diferente.
      expect(Math.abs(dashboard.health[issue] - listed.meta.total)).toBeLessThanOrEqual(5);
    }
  });

  it('keeps totals consistent and lists root categories by total', async () => {
    const dashboard = await getCatalogDashboard();
    const { products } = dashboard;
    expect(products.total).toBeGreaterThanOrEqual(1);
    expect(products.total).toBe(products.active + products.draft + products.archived);
    expect(dashboard.skus.total).toBeGreaterThanOrEqual(dashboard.skus.active);
    expect(dashboard.stock.units).toBeGreaterThanOrEqual(0);
    const counts = dashboard.by_category.map((category) => category.product_count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('our fixture product (no photo, brand, description, weight, price, stock) is in the pendencies', async () => {
    const issues = [
      'no_photo',
      'out_of_stock',
      'no_price',
      'no_brand',
      'no_description',
      'no_weight',
    ] as const;
    for (const issue of issues) {
      const listed = await listProducts({
        page: 1,
        page_size: 50,
        category_id: fx.categoryId,
        issue,
      });
      expect(listed.data.map((p) => p.product_id)).toContain(fx.productId);
    }
  });
});
