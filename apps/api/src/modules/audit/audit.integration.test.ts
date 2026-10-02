import { prisma } from '@geekstore/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeAuditLog } from '../../core/audit';
import { type CatalogFixture, createCatalogFixture } from '../../test-support/fixtures';
import { createProduct, updateProduct } from '../catalog/product.service';
import { listAuditLogs } from './audit.service';

describe('audit log (integration — requires a live DATABASE_URL)', () => {
  let fx: CatalogFixture;

  beforeAll(async () => {
    fx = await createCatalogFixture();
  });

  afterAll(async () => {
    await fx.cleanup();
    await prisma.$disconnect();
  });

  it('a rolled-back transaction leaves neither the change nor an orphan audit log', async () => {
    const slug = `${fx.suffix}-rollback`;
    const entityId = crypto.randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.category.create({
          data: { category_id: entityId, name: 'Rollback', slug },
        });
        await writeAuditLog(tx, {
          userId: fx.userId,
          entity: 'category',
          entityId,
          action: 'create',
          after: { slug },
        });
        throw new Error('falha depois de gravar tudo');
      })
    ).rejects.toThrow('falha depois');

    expect(await prisma.category.count({ where: { slug } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity_id: entityId } })).toBe(0);
  });

  it('records who/when/before/after for product and SKU changes in the same transaction', async () => {
    const created = await createProduct(fx.userId, {
      category_id: fx.categoryId,
      code: `AUD-${fx.suffix.toUpperCase()}`,
      name: 'Auditado',
      slug: `${fx.suffix}-auditado`,
      description: null,
      brand_id: null,
      status: 'draft',
      seo_title: null,
      seo_description: null,
      canonical_url: null,
      skus: [
        {
          code: `AUD-${fx.suffix.toUpperCase()}`,
          attributes: {},
          ean: null,
          weight_g: null,
          length_mm: null,
          width_mm: null,
          height_mm: null,
          ncm: null,
          manufacturer_code: null,
          cost_cents: null,
          status: 'active',
          price_cents: null,
          initial_stock: null,
        },
      ],
    });
    await updateProduct(fx.userId, created.product_id, { name: 'Auditado v2' });

    const productLogs = await listAuditLogs({
      page: 1,
      page_size: 20,
      entity: 'product',
      entity_id: created.product_id,
    });
    expect(productLogs.data.map((log) => log.action)).toEqual(['update', 'create']);
    expect(productLogs.data[0]).toMatchObject({
      user_id: fx.userId,
      before: { name: 'Auditado' },
      after: { name: 'Auditado v2' },
    });

    const skuId = created.skus[0]?.sku_id as string;
    const skuLogs = await listAuditLogs({
      page: 1,
      page_size: 20,
      entity: 'sku',
      entity_id: skuId,
    });
    expect(skuLogs.data).toHaveLength(1);
    expect(skuLogs.data[0]?.action).toBe('create');
  });
});
