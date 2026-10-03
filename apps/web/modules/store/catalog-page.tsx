import type { StoreCategory } from '@geekstore/shared';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getQueryClient } from '@/lib/get-query-client';
import { getMascot } from '@/lib/mascot';
import {
  type CatalogState,
  catalogHref,
  hasActiveFilters,
  PAGE_SIZE,
  SORT_OPTIONS,
  toApiFilters,
} from './lib/catalog-url';
import { formatBRL } from './lib/money';
import { Pagination } from './pagination';
import { ProductGrid } from './product-card';
import {
  storeCategoriesQuery,
  storeFacetsQuery,
  storeProductsQuery,
} from './services/catalog/queries';

const FILTER_TITLE = 'mb-3 text-sm font-extrabold';
const FILTER_LINK =
  'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-surface-secondary';
const FILTER_INPUT =
  'h-[42px] w-full rounded-[7px] border border-border bg-surface-secondary px-3 text-sm text-foreground';
const VISIBLE_BRANDS = 8;

/** Árvore de categorias: raízes, e dentro da que está aberta (ou é ancestral da escolhida) os filhos. */
function CategoryFilter({
  categories,
  state,
}: {
  categories: StoreCategory[];
  state: CatalogState;
}) {
  const byParent = new Map<string | null, StoreCategory[]>();
  for (const category of categories) {
    byParent.set(category.parent_id, [...(byParent.get(category.parent_id) ?? []), category]);
  }
  const selected = categories.find((category) => category.slug === state.categoria);
  const openIds = new Set<string>();
  for (
    let cursor = selected;
    cursor;
    cursor = categories.find((c) => c.category_id === cursor?.parent_id)
  ) {
    openIds.add(cursor.category_id);
  }

  const render = (parent: string | null, depth: number) =>
    (byParent.get(parent) ?? []).map((category) => {
      const isSelected = category.slug === state.categoria;
      return (
        <li key={category.category_id}>
          <Link
            href={catalogHref(state, { categoria: category.slug })}
            aria-current={isSelected ? 'page' : undefined}
            className={`${FILTER_LINK} ${isSelected ? 'bg-geek-yellow font-extrabold text-ink hover:bg-geek-yellow' : ''}`}
            style={{ paddingLeft: `${0.625 + depth * 0.9}rem` }}
          >
            <span className="truncate">{category.name}</span>
            <span className={`text-xs tabular-nums ${isSelected ? '' : 'text-muted'}`}>
              {category.product_count}
            </span>
          </Link>
          {openIds.has(category.category_id) && <ul>{render(category.category_id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <ul className="grid gap-0.5">
      <li>
        <Link
          href={catalogHref(state, { categoria: '' })}
          className={`${FILTER_LINK} ${state.categoria ? '' : 'font-extrabold'}`}
        >
          Todas as categorias
        </Link>
      </li>
      {render(null, 0)}
    </ul>
  );
}

export async function CatalogPage({ state }: { state: CatalogState }) {
  const client = getQueryClient();
  const filters = toApiFilters(state);
  const [products, facets, categories] = await Promise.all([
    client.fetchQuery(
      storeProductsQuery({
        ...filters,
        sort: state.ordem,
        page: state.pagina,
        page_size: PAGE_SIZE,
      })
    ),
    client.fetchQuery(storeFacetsQuery(filters)),
    client.fetchQuery(storeCategoriesQuery()),
  ]);

  const category = categories.find((item) => item.slug === state.categoria);
  const title = state.q ? `Resultados para “${state.q}”` : (category?.name ?? 'Explore a coleção');
  const brandName = facets.brands.find((brand) => brand.slug === state.marca)?.name;
  const chips = [
    state.q && { label: `Busca: ${state.q}`, href: catalogHref(state, { q: '' }) },
    category && { label: category.name, href: catalogHref(state, { categoria: '' }) },
    state.marca && { label: brandName ?? state.marca, href: catalogHref(state, { marca: '' }) },
    state.preco_min && {
      label: `A partir de R$ ${state.preco_min}`,
      href: catalogHref(state, { preco_min: '' }),
    },
    state.preco_max && {
      label: `Até R$ ${state.preco_max}`,
      href: catalogHref(state, { preco_max: '' }),
    },
    state.estoque && { label: 'Em estoque', href: catalogHref(state, { estoque: false }) },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));

  const filterPanel = (
    <form action="/catalogo/" method="get" className="grid gap-7">
      {state.q && <input type="hidden" name="q" value={state.q} />}
      {state.categoria && <input type="hidden" name="categoria" value={state.categoria} />}
      {state.marca && <input type="hidden" name="marca" value={state.marca} />}
      {state.ordem !== 'relevance' && <input type="hidden" name="ordem" value={state.ordem} />}
      <section aria-labelledby="f-cat">
        <h2 id="f-cat" className={FILTER_TITLE}>
          Categorias
        </h2>
        <CategoryFilter categories={categories} state={state} />
      </section>
      {facets.brands.length > 0 && (
        <section aria-labelledby="f-brand">
          <h2 id="f-brand" className={FILTER_TITLE}>
            Marcas
          </h2>
          <ul className="grid gap-0.5">
            {facets.brands.slice(0, VISIBLE_BRANDS).map((brand) => {
              const isSelected = brand.slug === state.marca;
              return (
                <li key={brand.slug}>
                  <Link
                    href={catalogHref(state, { marca: isSelected ? '' : brand.slug })}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`${FILTER_LINK} ${isSelected ? 'bg-geek-yellow font-extrabold text-ink hover:bg-geek-yellow' : ''}`}
                  >
                    <span className="truncate">{brand.name}</span>
                    <span className={`text-xs tabular-nums ${isSelected ? '' : 'text-muted'}`}>
                      {brand.product_count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {facets.brands.length > VISIBLE_BRANDS && (
            <details className="mt-1">
              <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-extrabold text-muted">
                Ver mais marcas
              </summary>
              <ul className="grid gap-0.5">
                {facets.brands.slice(VISIBLE_BRANDS).map((brand) => (
                  <li key={brand.slug}>
                    <Link href={catalogHref(state, { marca: brand.slug })} className={FILTER_LINK}>
                      <span className="truncate">{brand.name}</span>
                      <span className="text-xs text-muted tabular-nums">{brand.product_count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <section aria-labelledby="f-price">
        <h2 id="f-price" className={FILTER_TITLE}>
          Preço
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted">
            De (R$)
            <input
              className={FILTER_INPUT}
              name="preco_min"
              inputMode="decimal"
              defaultValue={state.preco_min}
              placeholder={
                facets.price_min_cents === null
                  ? '0'
                  : String(Math.floor(facets.price_min_cents / 100))
              }
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Até (R$)
            <input
              className={FILTER_INPUT}
              name="preco_max"
              inputMode="decimal"
              defaultValue={state.preco_max}
              placeholder={
                facets.price_max_cents === null
                  ? ''
                  : String(Math.ceil(facets.price_max_cents / 100))
              }
            />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="estoque"
            value="1"
            defaultChecked={state.estoque}
            className="size-4 accent-geek-yellow"
          />
          Somente em estoque
        </label>
        <button type="submit" className="action mt-4 w-full justify-center">
          Aplicar
        </button>
      </section>
    </form>
  );

  return (
    <section className="wrap-wide section">
      <nav aria-label="Você está em" className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href="/">Início</Link>
        <ChevronRight size={14} aria-hidden="true" />
        {category ? (
          <>
            <Link href="/catalogo/">Catálogo</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{category.name}</span>
          </>
        ) : (
          <span aria-current="page">Catálogo</span>
        )}
      </nav>
      <p className="eyebrow orange">Encontre sua próxima história</p>
      <h1 className="section-title">{title}</h1>
      <div className="mt-6 grid grid-cols-[250px_1fr] items-start gap-8 max-tablet:grid-cols-1 max-tablet:gap-5">
        {/* Fixo logo abaixo do cabeçalho (a altura dele é publicada pelo Shell) e com rolagem própria. */}
        <aside className="sticky top-[calc(var(--store-header-h,120px)+16px)] max-h-[calc(100dvh-var(--store-header-h,120px)-32px)] self-start overflow-y-auto overscroll-contain pr-2 transition-[top,max-height] duration-300 [scrollbar-width:thin] max-tablet:hidden">
          {filterPanel}
        </aside>
        <details className="rounded-[14px] border border-border bg-surface p-4 tablet:hidden">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
            <SlidersHorizontal size={16} aria-hidden="true" /> Filtros
          </summary>
          <div className="mt-4">{filterPanel}</div>
        </details>
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {products.meta.total.toLocaleString('pt-BR')}{' '}
              {products.meta.total === 1 ? 'produto' : 'produtos'}
              {facets.price_min_cents !== null && (
                <span className="max-md:hidden">
                  {' '}
                  · de {formatBRL(facets.price_min_cents)} a{' '}
                  {formatBRL(facets.price_max_cents ?? 0)}
                </span>
              )}
            </p>
            <nav aria-label="Ordenar por" className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={catalogHref(state, { ordem: option.value })}
                  aria-current={state.ordem === option.value ? 'true' : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-extrabold ${state.ordem === option.value ? 'border-geek-yellow bg-geek-yellow text-ink' : 'border-border bg-surface hover:border-ink'}`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>
          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-xs font-extrabold hover:bg-geek-yellow hover:text-ink"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  {chip.label} <X size={12} aria-hidden="true" />
                </Link>
              ))}
              <Link href="/catalogo/" className="text-xs font-extrabold underline">
                Limpar tudo
              </Link>
            </div>
          )}
          {products.data.length > 0 ? (
            <>
              <ProductGrid items={products.data} />
              <Pagination
                meta={products.meta}
                hrefFor={(page) => catalogHref(state, { pagina: page })}
              />
            </>
          ) : (
            <div className="empty">
              <Image {...getMascot('search')} width={210} height={240} />
              <h2 className="section-title">Ainda não encontramos.</h2>
              <p>Tente outra busca ou limpe os filtros.</p>
              {hasActiveFilters(state) && (
                <Link href="/catalogo/" className="action">
                  Limpar filtros
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="demo-note">
        Condições de pagamento e frete de exemplo; as fotos são de fornecedores e serão trocadas
        pelas fotos da loja.
      </p>
    </section>
  );
}
