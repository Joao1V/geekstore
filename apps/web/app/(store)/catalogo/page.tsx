import { CatalogPage } from '@/modules/store/catalog-page';
import { parseCatalogState } from '@/modules/store/lib/catalog-url';

export const metadata = { title: 'Catálogo' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage state={parseCatalogState(await searchParams)} />;
}
