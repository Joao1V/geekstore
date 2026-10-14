import { notFound, permanentRedirect } from 'next/navigation';

import { getQueryClient } from '@/lib/get-query-client';
import { storeResolveQuery } from '@/modules/store/services/catalog/queries';

// Endereço antigo `/produto/<slug>/` (carrinho, favoritos e links já compartilhados): leva ao canônico.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getQueryClient().fetchQuery(storeResolveQuery(`/${slug}/`));
  if (found.type !== 'product') notFound();
  permanentRedirect(found.path);
}
