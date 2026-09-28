'use client';

import { Button } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Heart, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Price } from '@/components/ui';
import { catalogService, matches, money, type Product, pixPrice, products } from '@/lib/catalog';
import { getMascot } from '@/lib/mascot';
import { useCartStore } from './state/cart-store';

const CATEGORIES = ['Todos', 'Colecionáveis', 'Games', 'Vestuário', 'RPG'];

export function ProductCard({ product: p }: { product: Product }) {
  const store = useCartStore();
  const isFavorite = store.favorites.includes(p.id);
  return (
    <article className="product-card">
      <div className="product-visual">
        <Link href={`/produto/${p.slug}/`} aria-label={`Ver ${p.name}`}>
          <Image src={p.image} alt={p.name} fill sizes="(max-width: 767px) 50vw, 25vw" />
        </Link>
        <span className="product-badge">
          {p.previousPrice ? `-${Math.round((1 - p.price / p.previousPrice) * 100)}%` : p.badge}
        </span>
        <Button
          isIconOnly
          className={`heart ${isFavorite ? 'selected' : ''}`}
          aria-label={`${isFavorite ? 'Remover dos' : 'Adicionar aos'} favoritos: ${p.name}`}
          aria-pressed={isFavorite}
          onPress={() => store.favorite(p.id)}
        >
          <Heart size={18} />
        </Button>
      </div>
      <div className="product-content">
        <p className="eyebrow muted">{p.universe}</p>
        <Link href={`/produto/${p.slug}/`} className="product-name">
          {p.name}
        </Link>
        <div className="previous-price">
          {p.previousPrice ? <del>{money(p.previousPrice)}</del> : <span>Preço da coleção</span>}
        </div>
        <Price value={pixPrice(p.price)} />
        <p className="pix">
          no Pix <span>5% de desconto*</span>
        </p>
        <p className="installments">
          ou {money(p.price)} em 6x de {money(p.price / 6)}
        </p>
        {p.price >= 299 && <small className="free-shipping">Frete grátis neste exemplo*</small>}
        {p.sizes ? (
          <Link className="card-buy" href={`/produto/${p.slug}/`}>
            Escolher tamanho <ArrowRight size={17} />
          </Link>
        ) : (
          <Button className="card-buy" onPress={() => store.add(p)}>
            <ShoppingBag size={17} /> Adicionar
          </Button>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ items = products }: { items?: Product[] }) {
  return (
    <div className="product-grid">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function Catalog({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const params = useSearchParams();
  const store = useCartStore();
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('Todos');
  const [sort, setSort] = useState('relevancia');
  const [max, setMax] = useState('');
  const [offers, setOffers] = useState(false);
  const {
    data = products,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['catalog'],
    queryFn: catalogService.list,
    initialData: products,
  });

  useEffect(() => {
    setTerm(params.get('q') || '');
    setCategory(params.get('categoria') || 'Todos');
    setOffers(params.get('ofertas') === '1');
  }, [params]);

  const filtered = data
    .filter(
      (p) =>
        (!favoritesOnly || store.favorites.includes(p.id)) &&
        matches(p, term) &&
        (category === 'Todos' || p.category === category) &&
        (!max || p.price <= Number(max)) &&
        (!offers || p.previousPrice)
    )
    .sort((a, b) => {
      if (sort === 'menor') return a.price - b.price;
      if (sort === 'maior') return b.price - a.price;
      if (sort === 'novos') return b.id - a.id;
      return 0;
    });

  const resetFilters = () => {
    setTerm('');
    setCategory('Todos');
    setMax('');
    setOffers(false);
    setSort('relevancia');
  };

  return (
    <section className="wrap section">
      <p className="eyebrow orange">
        {favoritesOnly ? 'Sua lista, seu universo' : 'Encontre sua próxima história'}
      </p>
      <h1 className="section-title">{favoritesOnly ? 'Seus favoritos' : 'Explore a coleção'}</h1>
      <div className="catalog-toolbar">
        <label className="filter-search">
          <Search size={18} />
          <input
            aria-label="Buscar no catálogo"
            placeholder="Produto, coleção ou universo"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label>
          <span>Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Até R$</span>
          <input
            type="number"
            min="0"
            placeholder="Sem limite"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
        <label>
          <span>Ordenar</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevancia">Relevância</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="novos">Novidades</option>
          </select>
        </label>
      </div>
      <div className="catalog-meta">
        <label>
          <input type="checkbox" checked={offers} onChange={(e) => setOffers(e.target.checked)} />{' '}
          Somente ofertas
        </label>
        <span>{filtered.length} produtos</span>
        <Button className="quiet" onPress={resetFilters}>
          <SlidersHorizontal size={15} /> Limpar filtros
        </Button>
      </div>
      {isError ? (
        <div className="empty">
          <p>Não foi possível carregar o catálogo.</p>
          <Button onPress={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : filtered.length ? (
        <ProductGrid items={filtered} />
      ) : (
        <div className="empty">
          <Image {...getMascot('search')} width={210} height={240} />
          <h2 className="section-title">Ainda não encontramos.</h2>
          <p>Tente outra busca ou limpe os filtros.</p>
          <Button className="action" onPress={resetFilters}>
            Limpar filtros
          </Button>
        </div>
      )}
      <p className="demo-note">
        Catálogo demonstrativo: imagens ilustrativas, estoque e condições de exemplo.
      </p>
    </section>
  );
}
