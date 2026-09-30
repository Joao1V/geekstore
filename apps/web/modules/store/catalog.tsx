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
const FREE_SHIPPING_MIN = 299;

const CARD_BUY =
  'mt-[15px] flex h-[42px] w-full items-center justify-center gap-2 rounded-[9px] bg-ink text-sm font-extrabold text-white hover:bg-geek-yellow hover:text-ink dark:bg-geek-yellow dark:text-ink max-md:h-[39px] max-md:gap-[5px] max-md:text-xs';
const FILTER_LABEL = 'flex flex-col gap-[5px] text-sm';
const FILTER_LABEL_TEXT = 'text-xs font-extrabold text-muted';
const FILTER_CONTROL = 'w-full rounded-[7px] bg-surface-secondary px-3 py-[9px] text-foreground';

export function ProductCard({ product: p }: { product: Product }) {
  const store = useCartStore();
  const isFavorite = store.favorites.includes(p.id);
  return (
    <article className="group overflow-hidden rounded-[17px] border-2 border-ink bg-surface transition-[translate,box-shadow] duration-200 [box-shadow:6px_6px_0_var(--ink-shadow)] hover:-translate-x-0.5 hover:-translate-y-[3px] hover:[box-shadow:8px_9px_0_var(--ink-shadow)] max-md:rounded-[13px] max-md:[box-shadow:4px_4px_var(--ink-shadow)]">
      <div className="relative aspect-square overflow-hidden bg-placeholder">
        <Link
          className="relative block h-full"
          href={`/produto/${p.slug}/`}
          aria-label={`Ver ${p.name}`}
        >
          <Image
            className="object-cover transition-transform duration-[400ms] group-hover:scale-[1.035]"
            src={p.image}
            alt={p.name}
            fill
            sizes="(max-width: 767px) 50vw, 25vw"
          />
        </Link>
        <span className="absolute top-3 left-3 rounded-[7px] bg-geek-yellow px-[9px] py-[5px] text-2xs font-black text-ink max-md:top-2 max-md:left-[7px] max-md:max-w-[calc(100%-47px)] max-md:px-1.5 max-md:py-1">
          {p.previousPrice ? `-${Math.round((1 - p.price / p.previousPrice) * 100)}%` : p.badge}
        </span>
        <Button
          isIconOnly
          className={`absolute top-[11px] right-[11px] size-[33px] min-w-[33px] rounded-full p-0 text-ink max-md:top-[7px] max-md:right-[7px] max-md:size-[27px] max-md:min-w-[27px] max-md:[&_svg]:w-[15px] ${isFavorite ? 'bg-geek-yellow [&_svg]:fill-ink' : 'bg-white'}`}
          aria-label={`${isFavorite ? 'Remover dos' : 'Adicionar aos'} favoritos: ${p.name}`}
          aria-pressed={isFavorite}
          onPress={() => store.favorite(p.id)}
        >
          <Heart size={18} />
        </Button>
      </div>
      <div className="px-[17px] pt-5 pb-[17px] max-tablet:px-3 max-tablet:py-[15px] max-md:px-2.5 max-md:py-3.5">
        <p className="eyebrow muted text-2xs max-md:tracking-[0.06em]">{p.universe}</p>
        <Link
          href={`/produto/${p.slug}/`}
          className="mt-[9px] mb-[13px] block min-h-12 text-base leading-[1.4] font-extrabold max-md:min-h-[54px] max-md:text-sm"
        >
          {p.name}
        </Link>
        <div className="mb-0.5 h-5 text-xs text-muted">
          {p.previousPrice ? <del>{money(p.previousPrice)}</del> : <span>Preço da coleção</span>}
        </div>
        <Price value={pixPrice(p.price)} />
        <p className="pix">
          no Pix <span>5% de desconto*</span>
        </p>
        <p className="mt-2 min-h-9 text-xs text-muted max-md:min-h-[33px] max-md:text-2xs">
          ou {money(p.price)} em 6x de {money(p.price / 6)}
        </p>
        {p.price >= FREE_SHIPPING_MIN && (
          <small className="mt-1 block text-xs text-status-success max-md:text-2xs">
            Frete grátis neste exemplo*
          </small>
        )}
        {p.sizes ? (
          <Link className={CARD_BUY} href={`/produto/${p.slug}/`}>
            Escolher tamanho <ArrowRight size={17} />
          </Link>
        ) : (
          <Button className={CARD_BUY} onPress={() => store.add(p)}>
            <ShoppingBag size={17} /> Adicionar
          </Button>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ items = products }: { items?: Product[] }) {
  return (
    <div className="grid grid-cols-4 gap-6 max-tablet:gap-[18px] max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-[22px]">
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
      <div className="mt-[30px] grid grid-cols-[2fr_1fr_0.8fr_1fr] gap-[15px] rounded-[14px] border border-border bg-surface p-5 max-md:grid-cols-2 max-md:gap-3 max-md:p-[15px]">
        <label className="flex items-center gap-2.5 text-sm text-foreground max-md:col-span-full">
          <Search size={18} />
          <input
            className={`${FILTER_CONTROL} h-[50px]`}
            aria-label="Buscar no catálogo"
            placeholder="Produto, coleção ou universo"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label className={FILTER_LABEL}>
          <span className={FILTER_LABEL_TEXT}>Categoria</span>
          <select
            className={`${FILTER_CONTROL} h-[42px]`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={FILTER_LABEL}>
          <span className={FILTER_LABEL_TEXT}>Até R$</span>
          <input
            className={`${FILTER_CONTROL} h-[42px]`}
            type="number"
            min="0"
            placeholder="Sem limite"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
        <label className={FILTER_LABEL}>
          <span className={FILTER_LABEL_TEXT}>Ordenar</span>
          <select
            className={`${FILTER_CONTROL} h-[42px]`}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="relevancia">Relevância</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="novos">Novidades</option>
          </select>
        </label>
      </div>
      <div className="mt-[18px] mb-[30px] flex items-center justify-between gap-4 text-sm text-muted max-md:flex-wrap max-md:text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={offers} onChange={(e) => setOffers(e.target.checked)} />{' '}
          Somente ofertas
        </label>
        <span>{filtered.length} produtos</span>
        <Button className="quiet max-md:text-xs" onPress={resetFilters}>
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
