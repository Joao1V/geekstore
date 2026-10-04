'use client';

import { Button } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, Search, TrendingUp, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { formatBRL } from './lib/money';
import { ProductImage } from './product-image';
import { storeProductsQuery } from './services/catalog/queries';
import { useCartStore } from './state/cart-store';

const CLOSE_DELAY_MS = 180;
const SUGGESTIONS = 4;
const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;
// Sugestões para quem ainda não buscou nada (ou limpou o histórico).
const POPULAR_SEARCHES = ['Funko Pop', 'LEGO', 'Pokémon', 'Harry Potter', 'Naruto', 'Hot Wheels'];

type SearchFormValues = { q: string };

const catalogHref = (term: string) => `/catalogo/?q=${encodeURIComponent(term)}`;
const SECTION_TITLE = 'text-xs tracking-[0.12em] text-muted';
const ROW = 'flex items-center gap-3 border-b border-border py-2.5 text-sm font-extrabold';

/** Valor que só muda depois de `delay` ms sem novas digitações (evita uma chamada por tecla). */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Campo de busca do cabeçalho: sugestões de produtos ao digitar e buscas recentes ao focar vazio. */
export function StoreSearch() {
  const router = useRouter();
  const path = usePathname();
  const recent = useCartStore((state) => state.recentSearches);
  const addRecent = useCartStore((state) => state.addRecentSearch);
  const removeRecent = useCartStore((state) => state.removeRecentSearch);
  const clearRecent = useCartStore((state) => state.clearRecentSearches);

  const { control, handleSubmit, setValue } = useForm<SearchFormValues>({
    defaultValues: { q: '' },
  });
  const search = useWatch({ control, name: 'q' }) ?? '';
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFocused(true);
  };
  // Fecha com um pequeno atraso: o clique num item do painel chega antes de ele sumir.
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setFocused(false), CLOSE_DELAY_MS);
  };
  const keepOpen = () => inputRef.current?.focus();

  // biome-ignore lint/correctness/useExhaustiveDependencies: path só dispara o fechamento ao trocar de página.
  useEffect(() => setFocused(false), [path]);

  const term = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data: suggestions } = useQuery({
    ...storeProductsQuery({ q: term, page_size: SUGGESTIONS }),
    enabled: term.length >= MIN_SEARCH_LENGTH,
  });
  const results = suggestions?.data ?? [];

  const remember = (value: string) => {
    if (value.trim().length >= MIN_SEARCH_LENGTH) addRecent(value.trim());
  };
  const go = (value: string) => {
    remember(value);
    setValue('q', value);
    setFocused(false);
    router.push(catalogHref(value));
  };

  return (
    <div className="relative min-w-[120px] flex-1 max-md:col-span-full max-md:row-start-2">
      <form
        onSubmit={handleSubmit(({ q }) => go(q.trim()))}
        className="flex h-[46px] items-center gap-2.5 rounded-[10px] bg-paper py-1 pr-[5px] pl-[15px] text-sm leading-normal font-semibold text-ink max-md:h-[41px]"
      >
        <Search size={20} />
        <Controller
          control={control}
          name="q"
          render={({ field }) => (
            <input
              {...field}
              ref={(element) => {
                field.ref(element);
                inputRef.current = element;
              }}
              className="w-full border-0 bg-transparent focus-visible:outline-none!"
              aria-label="Buscar produtos"
              autoComplete="off"
              onFocus={open}
              onBlur={() => {
                field.onBlur();
                closeSoon();
              }}
              placeholder="Qual é o seu próximo universo?"
            />
          )}
        />
        <Button
          isIconOnly
          type="submit"
          aria-label="Pesquisar"
          className="size-9 min-w-9 rounded-lg bg-geek-yellow text-ink"
        >
          <ArrowRight size={20} />
        </Button>
      </form>
      {focused && (
        <div className="absolute inset-x-0 top-[54px] z-[51] rounded-xl border border-border bg-surface p-[18px] text-foreground [box-shadow:0_20px_45px_#0003]">
          {search.trim() ? (
            <>
              <small className={SECTION_TITLE}>PRODUTOS</small>
              {results.length ? (
                <>
                  {results.map((product) => (
                    <Link
                      key={product.product_id}
                      href={`/produto/${product.slug}/`}
                      onClick={() => {
                        remember(search);
                        setFocused(false);
                      }}
                      className={ROW}
                    >
                      <span className="block size-[45px] shrink-0 overflow-hidden rounded-[7px]">
                        <ProductImage src={product.image_url} alt="" />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2">{product.name}</span>
                        <small className="mt-1 block text-xs text-muted">
                          {formatBRL(product.price_cents)}
                        </small>
                      </span>
                    </Link>
                  ))}
                  <Link
                    href={catalogHref(search.trim())}
                    onClick={() => {
                      remember(search);
                      setFocused(false);
                    }}
                    className="mt-3 block text-sm font-extrabold underline"
                  >
                    Ver todos os resultados
                  </Link>
                </>
              ) : term.length < MIN_SEARCH_LENGTH || !suggestions ? (
                <p className="text-sm text-muted">Buscando…</p>
              ) : (
                <p className="text-sm">Nenhum produto. Tente “funko” ou “lego”.</p>
              )}
            </>
          ) : (
            <>
              {recent.length > 0 && (
                <section aria-label="Buscas recentes">
                  <div className="flex items-center justify-between">
                    <small className={SECTION_TITLE}>BUSCAS RECENTES</small>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecent();
                        keepOpen();
                      }}
                      className="text-xs font-extrabold underline"
                    >
                      Limpar
                    </button>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {recent.map((item) => (
                      <li key={item} className={`${ROW} justify-between`}>
                        <Link
                          href={catalogHref(item)}
                          onClick={() => go(item)}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <Clock size={16} className="shrink-0 text-muted" aria-hidden="true" />
                          <span className="truncate">{item}</span>
                        </Link>
                        <button
                          type="button"
                          aria-label={`Remover ${item} das buscas recentes`}
                          onClick={() => {
                            removeRecent(item);
                            keepOpen();
                          }}
                          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-secondary"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section aria-label="Buscas populares" className={recent.length > 0 ? 'mt-4' : ''}>
                <small className={`${SECTION_TITLE} flex items-center gap-1.5`}>
                  <TrendingUp size={13} aria-hidden="true" /> POPULARES
                </small>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((item) => (
                    <Link
                      key={item}
                      href={catalogHref(item)}
                      onClick={() => go(item)}
                      className="rounded-full border border-border px-3 py-1.5 text-sm font-extrabold hover:border-ink"
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
