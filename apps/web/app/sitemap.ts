import type { StorePageLink, StoreSitemap } from '@geekstore/shared';
import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { isSiteNoindex } from '@/lib/indexing';

// Dinâmico: sem indexação liberada (lib/indexing.ts) o sitemap sai vazio, em vez de anunciar URLs.
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lojageekstore.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isSiteNoindex()) return [];
  const [{ products, categories }, pages] = await Promise.all([
    api.get<StoreSitemap>('/api/store/sitemap'),
    api.get<StorePageLink[]>('/api/store/pages'),
  ]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/catalogo/`, changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((category) => ({
      url: `${SITE_URL}${category.path}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...pages.map((page) => ({
      url: `${SITE_URL}/pagina/${page.slug}/`,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
    ...products.map((product) => ({
      url: `${SITE_URL}${product.path}`,
      lastModified: product.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
