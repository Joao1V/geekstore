import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExternalApiError } from '../../core/_errors';
import { buildObjectKey, createUploadUrl } from './media.storage';

const S3_VARS = [
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_BASE_URL',
] as const;

afterEach(() => vi.unstubAllEnvs());

describe('media storage', () => {
  it('builds a dated key with the extension of the content type', () => {
    const key = buildObjectKey('image/webp', new Date('2026-09-30T12:00:00Z'));
    expect(key).toMatch(/^products\/2026\/09\/[0-9a-f-]{36}\.webp$/);
  });

  it('answers a clear error (not a crash) when the bucket is not configured', async () => {
    for (const name of S3_VARS) vi.stubEnv(name, undefined);

    await expect(
      createUploadUrl({ content_type: 'image/png', size_bytes: 10 })
    ).rejects.toBeInstanceOf(ExternalApiError);
  });

  it('signs a PUT URL bound to content type and length when configured', async () => {
    vi.stubEnv('S3_ENDPOINT', 'http://localhost:9100');
    vi.stubEnv('S3_BUCKET', 'bucket');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'key');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('S3_PUBLIC_BASE_URL', 'https://cdn.example.com/');

    const result = await createUploadUrl({ content_type: 'image/png', size_bytes: 10 });
    const url = new URL(result.upload_url);

    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    expect(result.public_url).toMatch(
      /^https:\/\/cdn\.example\.com\/products\/\d{4}\/\d{2}\/.+\.png$/
    );
    expect(result.expires_in).toBe(300);
  });
});
