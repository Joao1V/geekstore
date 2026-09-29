import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginatedResponse,
  paginationQuerySchema,
} from '@geekstore/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, page_size: DEFAULT_PAGE_SIZE });
  });

  it('coerces query-string values', () => {
    expect(
      paginationQuerySchema.parse({ page: '3', page_size: '50', sort: 'created_at:desc' })
    ).toEqual({
      page: 3,
      page_size: 50,
      sort: 'created_at:desc',
    });
  });

  it('rejects page_size above the maximum and page below 1', () => {
    expect(paginationQuerySchema.safeParse({ page_size: MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe('paginatedResponse', () => {
  const schema = paginatedResponse(z.object({ sku_id: z.string() }));

  it('accepts { data, meta } with snake_case meta', () => {
    const body = {
      data: [{ sku_id: 'a' }],
      meta: { page: 1, page_size: 20, total: 1, total_pages: 1 },
    };
    expect(schema.parse(body)).toEqual(body);
  });

  it('rejects a bare array', () => {
    expect(schema.safeParse([{ sku_id: 'a' }]).success).toBe(false);
  });
});
