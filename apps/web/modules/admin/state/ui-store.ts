import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminTheme = 'light' | 'dark';

/** Chave do localStorage; o script do layout (anti-flash) lê a mesma. */
export const ADMIN_UI_STORAGE_KEY = 'geekstore-admin-ui';

type AdminUiState = {
  theme: AdminTheme;
  sidebarCollapsed: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
};

// `skipHydration`: o servidor renderiza com os padrões (claro, menu aberto) e o cliente só lê o
// localStorage depois de montar (`rehydrate()` no AdminShell), para não dar erro de hidratação.
export const useAdminUiStore = create<AdminUiState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: ADMIN_UI_STORAGE_KEY,
      skipHydration: true,
      partialize: ({ theme, sidebarCollapsed }) => ({ theme, sidebarCollapsed }),
    }
  )
);
