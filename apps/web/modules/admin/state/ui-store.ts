import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminTheme = 'light' | 'dark';

/** Chave do localStorage; o script do layout (anti-flash) lê a mesma. */
export const ADMIN_UI_STORAGE_KEY = 'geekstore-admin-ui';

type AdminUiState = {
  theme: AdminTheme;
  sidebarCollapsed: boolean;
  /** Rótulos dos grupos do menu que o usuário minimizou. */
  collapsedGroups: string[];
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleGroup: (label: string) => void;
};

// `skipHydration`: o servidor renderiza com os padrões (claro, menu aberto) e o cliente só lê o
// localStorage depois de montar (`rehydrate()` no AdminShell), para não dar erro de hidratação.
export const useAdminUiStore = create<AdminUiState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      collapsedGroups: [],
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleGroup: (label) =>
        set((state) => ({
          collapsedGroups: state.collapsedGroups.includes(label)
            ? state.collapsedGroups.filter((item) => item !== label)
            : [...state.collapsedGroups, label],
        })),
    }),
    {
      name: ADMIN_UI_STORAGE_KEY,
      skipHydration: true,
      partialize: ({ theme, sidebarCollapsed, collapsedGroups }) => ({
        theme,
        sidebarCollapsed,
        collapsedGroups,
      }),
    }
  )
);
