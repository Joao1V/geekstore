import { Suspense } from 'react';
import { Catalog } from '@/modules/store/catalog';

export const metadata = { title: 'Catálogo' };

export default function Page() {
  return (
    <Suspense fallback={<p className="wrap section">Carregando catálogo…</p>}>
      <Catalog />
    </Suspense>
  );
}
