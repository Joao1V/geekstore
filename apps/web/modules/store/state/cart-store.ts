import type { CartCheckLine } from '@geekstore/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Uma linha do carrinho: guarda o que a tela precisa mostrar (nada de buscar o produto de novo). */
export type CartLine = {
  sku_id: string;
  slug: string;
  name: string;
  /** "Preto · GG"; vazio em produto sem variação. */
  variant: string;
  image_url: string | null;
  price_cents: number;
  qty: number;
  /** Unidades disponíveis quando foi adicionado: o teto da quantidade. */
  max: number;
};
export type CartItem = Omit<CartLine, 'qty'>;
export type ToastNotice = { message: string; kind: 'success' | 'warning' | 'info'; id: number };

type CartState = {
  lines: CartLine[];
  /** product_id dos favoritos. */
  favorites: string[];
  /** Termos buscados, o mais recente primeiro (no máximo MAX_RECENT_SEARCHES). */
  recentSearches: string[];
  theme: 'light' | 'dark';
  /** Cabeçalho preto sólido ou "vidro" (translúcido com desfoque). Em avaliação: ver StoreHeader. */
  headerStyle: 'solid' | 'glass';
  cartOpen: boolean;
  toast: ToastNotice | null;
  hasHydrated: boolean;
  add: (item: CartItem, qty?: number) => boolean;
  quantity: (skuId: string, qty: number) => void;
  /** Acerta o carrinho com o que o servidor diz (item sumiu, preço mudou, estoque caiu). Devolve o que mudou. */
  reconcile: (checks: CartCheckLine[]) => { removed: number; adjusted: number };
  clear: () => void;
  favorite: (productId: string) => void;
  addRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  toggleTheme: () => void;
  toggleHeaderStyle: () => void;
  setCartOpen: (open: boolean) => void;
  notify: (message: string) => void;
  dismissToast: () => void;
  setHasHydrated: (value: boolean) => void;
};

const STORAGE_VERSION = 2;
const MAX_RECENT_SEARCHES = 6;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      favorites: [],
      recentSearches: [],
      theme: 'light',
      headerStyle: 'glass',
      cartOpen: false,
      toast: null,
      hasHydrated: false,
      add: (item, qty = 1) => {
        const inCart = get().lines.find((line) => line.sku_id === item.sku_id)?.qty ?? 0;
        if (item.max <= 0 || inCart + qty > item.max) {
          set({
            toast: {
              message: 'Você atingiu o estoque disponível deste item.',
              kind: 'warning',
              id: Date.now(),
            },
          });
          return false;
        }
        set((state) => ({
          lines: inCart
            ? state.lines.map((line) =>
                line.sku_id === item.sku_id ? { ...line, ...item, qty: line.qty + qty } : line
              )
            : [...state.lines, { ...item, qty }],
          toast: { message: 'Produto adicionado ao carrinho.', kind: 'success', id: Date.now() },
        }));
        return true;
      },
      quantity: (skuId, qty) =>
        set((state) => {
          if (qty <= 0) return { lines: state.lines.filter((line) => line.sku_id !== skuId) };
          return {
            lines: state.lines.map((line) =>
              line.sku_id === skuId ? { ...line, qty: Math.min(qty, line.max) } : line
            ),
          };
        }),
      reconcile: (checks) => {
        const byId = new Map(checks.map((check) => [check.sku_id, check]));
        let removed = 0;
        let adjusted = 0;
        const lines = get().lines.flatMap((line) => {
          const check = byId.get(line.sku_id);
          if (!check) return [line];
          if (!check.valid || check.available <= 0) {
            removed += 1;
            return [];
          }
          const qty = Math.min(line.qty, check.available);
          const price = check.price_cents ?? line.price_cents;
          if (qty !== line.qty || price !== line.price_cents || check.available !== line.max)
            adjusted += 1;
          return [{ ...line, qty, price_cents: price, max: check.available }];
        });
        if (removed > 0 || adjusted > 0) set({ lines });
        return { removed, adjusted };
      },
      clear: () => set({ lines: [] }),
      favorite: (productId) =>
        set((state) => ({
          favorites: state.favorites.includes(productId)
            ? state.favorites.filter((id) => id !== productId)
            : [...state.favorites, productId],
        })),
      addRecentSearch: (term) =>
        set((state) => ({
          recentSearches: [
            term,
            ...state.recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase()),
          ].slice(0, MAX_RECENT_SEARCHES),
        })),
      removeRecentSearch: (term) =>
        set((state) => ({ recentSearches: state.recentSearches.filter((item) => item !== term) })),
      clearRecentSearches: () => set({ recentSearches: [] }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      toggleHeaderStyle: () =>
        set((state) => ({ headerStyle: state.headerStyle === 'glass' ? 'solid' : 'glass' })),
      setCartOpen: (open) => set({ cartOpen: open }),
      notify: (message) => set({ toast: { message, kind: 'info', id: Date.now() } }),
      dismissToast: () => set({ toast: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'geekstore-store',
      version: STORAGE_VERSION,
      // Versão 1 guardava ids numéricos do catálogo de demonstração: carrinho e favoritos antigos
      // não valem mais; o tema continua.
      migrate: (persisted) => {
        const previous = persisted as {
          theme?: 'light' | 'dark';
          headerStyle?: 'solid' | 'glass';
        } | null;
        return {
          theme: previous?.theme ?? 'light',
          headerStyle: previous?.headerStyle ?? 'glass',
          lines: [],
          favorites: [],
          recentSearches: [],
        };
      },
      partialize: (state) => ({
        lines: state.lines,
        favorites: state.favorites,
        theme: state.theme,
        headerStyle: state.headerStyle,
        recentSearches: state.recentSearches,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.lines = state.lines.filter(
          (line) => line.sku_id && Number.isInteger(line.qty) && line.qty > 0
        );
        state.setHasHydrated(true);
      },
    }
  )
);
