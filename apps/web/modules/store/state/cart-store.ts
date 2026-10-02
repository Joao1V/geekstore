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
  theme: 'light' | 'dark';
  cartOpen: boolean;
  toast: ToastNotice | null;
  hasHydrated: boolean;
  add: (item: CartItem, qty?: number) => boolean;
  quantity: (skuId: string, qty: number) => void;
  clear: () => void;
  favorite: (productId: string) => void;
  toggleTheme: () => void;
  setCartOpen: (open: boolean) => void;
  notify: (message: string) => void;
  dismissToast: () => void;
  setHasHydrated: (value: boolean) => void;
};

const STORAGE_VERSION = 2;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      favorites: [],
      theme: 'light',
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
      clear: () => set({ lines: [] }),
      favorite: (productId) =>
        set((state) => ({
          favorites: state.favorites.includes(productId)
            ? state.favorites.filter((id) => id !== productId)
            : [...state.favorites, productId],
        })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
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
      migrate: (persisted) => ({
        theme: (persisted as { theme?: 'light' | 'dark' } | null)?.theme ?? 'light',
        lines: [],
        favorites: [],
      }),
      partialize: (state) => ({
        lines: state.lines,
        favorites: state.favorites,
        theme: state.theme,
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
