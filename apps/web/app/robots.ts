import type { MetadataRoute } from 'next';
import { isSiteNoindex } from '@/lib/indexing';

// Dinâmico: lê `NOINDEX` em runtime (lib/indexing.ts), não no build.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (isSiteNoindex()) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] } };
}
