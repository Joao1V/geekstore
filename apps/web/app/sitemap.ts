import type { MetadataRoute } from 'next';
import { products } from '@/lib/catalog';

export const dynamic = 'force-static';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lojageekstore.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/catalogo', ...products.map((p) => `/produto/${p.slug}`)];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}/`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));
}
