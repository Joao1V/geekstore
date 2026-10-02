import type { StoreSort } from '@geekstore/shared';

// Filtros do catálogo na URL, em português (`/catalogo/?categoria=jogos&marca=funko&preco_max=200`):
// compartilháveis, funcionam sem JavaScript e a página é gerada no servidor.

export const SORT_OPTIONS: { value: StoreSort; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'newest', label: 'Novidades' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name', label: 'A–Z' },
];
const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

export const PAGE_SIZE = 24;
const CENTS_PER_REAL = 100;

export type CatalogState = {
  q: string;
  categoria: string;
  marca: string;
  preco_min: string;
  preco_max: string;
  estoque: boolean;
  ordem: StoreSort;
  pagina: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

export function parseCatalogState(raw: RawParams): CatalogState {
  const ordem = first(raw.ordem);
  return {
    q: first(raw.q),
    categoria: first(raw.categoria),
    marca: first(raw.marca),
    preco_min: first(raw.preco_min),
    preco_max: first(raw.preco_max),
    estoque: first(raw.estoque) === '1',
    ordem: SORT_VALUES.has(ordem) ? (ordem as StoreSort) : 'relevance',
    pagina: Math.max(1, Number.parseInt(first(raw.pagina), 10) || 1),
  };
}

/** Reais digitados ("49,90") -> centavos; vazio ou inválido -> `undefined` (sem limite). */
function toCents(value: string): number | undefined {
  if (!value) return undefined;
  const reais = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(reais) && reais >= 0 ? Math.round(reais * CENTS_PER_REAL) : undefined;
}

/** Os filtros no formato da API (sem página e ordem). */
export function toApiFilters(state: CatalogState) {
  return {
    q: state.q || undefined,
    category: state.categoria || undefined,
    brand: state.marca || undefined,
    price_min: toCents(state.preco_min),
    price_max: toCents(state.preco_max),
    in_stock: state.estoque || undefined,
  };
}

/** Link do catálogo com o estado atual, mudando só o que veio em `patch` (muda filtro: volta à página 1). */
export function catalogHref(state: CatalogState, patch: Partial<CatalogState>): string {
  const next = { ...state, pagina: 1, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.categoria) params.set('categoria', next.categoria);
  if (next.marca) params.set('marca', next.marca);
  if (next.preco_min) params.set('preco_min', next.preco_min);
  if (next.preco_max) params.set('preco_max', next.preco_max);
  if (next.estoque) params.set('estoque', '1');
  if (next.ordem !== 'relevance') params.set('ordem', next.ordem);
  if (next.pagina > 1) params.set('pagina', String(next.pagina));
  const query = params.toString();
  return query ? `/catalogo/?${query}` : '/catalogo/';
}

export function hasActiveFilters(state: CatalogState): boolean {
  return Boolean(
    state.q || state.categoria || state.marca || state.preco_min || state.preco_max || state.estoque
  );
}
