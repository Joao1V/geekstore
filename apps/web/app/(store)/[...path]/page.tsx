import { notFound, permanentRedirect } from 'next/navigation';

import { getQueryClient } from '@/lib/get-query-client';
import { CatalogPage } from '@/modules/store/catalog-page';
import { parseCatalogState } from '@/modules/store/lib/catalog-url';
import { ProductDetail } from '@/modules/store/product-detail';
import { storeProductQuery, storeResolveQuery } from '@/modules/store/services/catalog/queries';

// Endereços no padrão da Tray (RF-VIT-05): `/categoria/sub/` é uma categoria e `/categoria/sub/slug/`
// é um produto. A API diz qual é e qual o endereço canônico; endereço diferente do canônico (produto
// movido de categoria, caminho incompleto) recebe 301 para ele.

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const toPath = (segments: string[]): string =>
  `/${segments.map((segment) => decodeURIComponent(segment)).join('/')}/`;

async function resolve(segments: string[]) {
  const requested = toPath(segments);
  const found = await getQueryClient().fetchQuery(storeResolveQuery(requested));
  if (found.type === 'none') notFound();
  return { requested, found };
}

export async function generateMetadata({ params }: Props) {
  const { found } = await resolve((await params).path);
  if (found.type === 'category') return { title: 'Catálogo' };
  const product = await getQueryClient().fetchQuery(storeProductQuery(found.slug));
  return {
    title: product.name,
    description: product.description?.slice(0, 160) ?? `Compre ${product.name} na GeekStore.`,
    alternates: { canonical: found.path },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { requested, found } = await resolve((await params).path);
  if (found.path !== requested) permanentRedirect(found.path);
  if (found.type === 'product') return <ProductDetail slug={found.slug} />;
  const state = parseCatalogState(await searchParams);
  return <CatalogPage state={{ ...state, categoria: found.slug }} />;
}
