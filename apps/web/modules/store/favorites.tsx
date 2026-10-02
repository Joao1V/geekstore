'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import Link from 'next/link';

import { ProductGrid } from './product-card';
import { storeProductsQuery } from './services/catalog/queries';
import { useCartStore } from './state/cart-store';

const MAX_FAVORITES = 60;

/** Favoritos ficam no navegador (ids); a página busca os dados atuais desses produtos na API. */
export function Favorites() {
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const favorites = useCartStore((state) => state.favorites);
  const ids = favorites.slice(0, MAX_FAVORITES).join(',');
  const { data, isPending, isError } = useQuery({
    ...storeProductsQuery({ ids, page_size: MAX_FAVORITES }),
    enabled: hasHydrated && ids.length > 0,
  });

  return (
    <section className="wrap section">
      <p className="eyebrow orange">Sua lista, seu universo</p>
      <h1 className="section-title">Seus favoritos</h1>
      <div className="mt-[30px]">
        {!hasHydrated || (ids && isPending) ? (
          <p className="muted">Carregando seus favoritos…</p>
        ) : isError ? (
          <p className="error" role="alert">
            Não foi possível carregar os favoritos agora.
          </p>
        ) : data && data.data.length > 0 ? (
          <ProductGrid items={data.data} />
        ) : (
          <div className="empty">
            <Heart size={48} aria-hidden="true" />
            <h2 className="section-title">Nada por aqui ainda.</h2>
            <p>Toque no coração de um produto para guardar na sua lista.</p>
            <Link href="/catalogo/" className="action">
              Explorar produtos
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
