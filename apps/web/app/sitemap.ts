import type { MetadataRoute } from 'next';
import { products } from '@/lib/catalog';
import { isSiteNoindex } from '@/lib/indexing';

// Dinâmico: sem indexação liberada (lib/indexing.ts) o sitemap sai vazio, em vez de anunciar URLs.
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lojageekstore.com';

export default function sitemap(): MetadataRoute.Sitemap {
  if (isSiteNoindex()) return [];
  const paths = ['', '/catalogo', ...products.map((p) => `/produto/${p.slug}`)];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}/`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));
}
