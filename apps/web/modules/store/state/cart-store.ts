import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Product, products } from '@/lib/catalog';

type CartLine = { id: number; size: string; qty: number };
export type ToastNotice = { message: string; kind: 'success' | 'warning' | 'info'; id: number };

type CartState = {
  lines: CartLine[];
  favorites: number[];
  theme: 'light' | 'dark';
  cartOpen: boolean;
  toast: ToastNotice | null;
  hasHydrated: boolean;
  add: (product: Product, qty?: number, size?: string) => boolean;
  quantity: (index: number, qty: number) => void;
  clear: () => void;
  favorite: (id: number) => void;
  toggleTheme: () => void;
  setCartOpen: (open: boolean) => void;
  notify: (message: string) => void;
  dismissToast: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      favorites: [],
      theme: 'light',
      cartOpen: false,
      toast: null,
      hasHydrated: false,
      add: (product, qty = 1, size = '') => {
        const alreadyInCart = get()
          .lines.filter((line) => line.id === product.id)
          .reduce((sum, line) => sum + line.qty, 0);
        if (alreadyInCart + qty > product.stock) {
          set({
            toast: {
              message: 'Você atingiu o estoque disponível neste exemplo.',
              kind: 'warning',
              id: Date.now(),
            },
          });
          return false;
        }
        set((state) => {
          const existingLine = state.lines.find(
            (line) => line.id === product.id && line.size === size
          );
          const lines = existingLine
            ? state.lines.map((line) =>
                line === existingLine ? { ...line, qty: line.qty + qty } : line
              )
            : [...state.lines, { id: product.id, size, qty }];
          return {
            lines,
            toast: { message: 'Produto adicionado ao carrinho.', kind: 'success', id: Date.now() },
          };
        });
        return true;
      },
      quantity: (index, qty) =>
        set((state) => {
          if (qty <= 0) return { lines: state.lines.filter((_, i) => i !== index) };
          const line = state.lines[index];
          const product = products.find((p) => p.id === line?.id);
          if (!line || !product) return state;
          const reservedElsewhere = state.lines
            .filter((l, i) => l.id === line.id && i !== index)
            .reduce((sum, l) => sum + l.qty, 0);
          return {
            lines: state.lines.map((l, i) =>
              i === index ? { ...l, qty: Math.min(qty, product.stock - reservedElsewhere) } : l
            ),
          };
        }),
      clear: () => set({ lines: [] }),
      favorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((favoriteId) => favoriteId !== id)
            : [...state.favorites, id],
        })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setCartOpen: (open) => set({ cartOpen: open }),
      notify: (message) => set({ toast: { message, kind: 'info', id: Date.now() } }),
      dismissToast: () => set({ toast: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'geekstore-store',
      partialize: (state) => ({
        lines: state.lines,
        favorites: state.favorites,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.lines = state.lines
          .filter(
            (line) =>
              products.some((p) => p.id === line.id) && Number.isInteger(line.qty) && line.qty > 0
          )
          .map((line) => {
            const product = products.find((p) => p.id === line.id);
            return product ? { ...line, qty: Math.min(line.qty, product.stock) } : line;
          });
        state.favorites = state.favorites.filter((id) => products.some((p) => p.id === id));
        state.setHasHydrated(true);
      },
    }
  )
);
