import { Suspense } from 'react';
import { Catalog } from '@/modules/store/catalog';

export const metadata = { title: 'Favoritos' };

export default function Page() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Catalog favoritesOnly />
    </Suspense>
  );
}
