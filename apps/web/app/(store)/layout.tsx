import { getQueryClient } from '@/lib/get-query-client';
import { storeHomeQuery } from '@/modules/store/services/catalog/queries';
import { type NavCategory, Shell } from '@/modules/store/shell';

// As páginas da loja leem a API na hora do pedido (os dados têm cache de 60 s, ver
// modules/store/services/catalog/queries.ts). No build a API não existe, então nada é pré-gerado.
export const dynamic = 'force-dynamic';

const NAV_CATEGORIES = 5;

/** Categorias do menu: as raízes com mais produtos. Se a API estiver fora, o menu fica sem elas (a loja abre). */
async function loadNavCategories(): Promise<NavCategory[]> {
  try {
    const home = await getQueryClient().fetchQuery(storeHomeQuery());
    return [...home.categories]
      .sort((a, b) => b.product_count - a.product_count)
      .slice(0, NAV_CATEGORIES)
      .map(({ name, slug }) => ({ name, slug }));
  } catch {
    return [];
  }
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  return <Shell categories={await loadNavCategories()}>{children}</Shell>;
}
