'use client';

import { I18nProvider, RouterProvider } from '@heroui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { getQueryClient } from '@/lib/get-query-client';

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const router = useRouter();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Links do HeroUI (breadcrumbs, paginação...) navegam pelo roteador do Next, sem recarregar. */}
      <RouterProvider navigate={(href) => router.push(href)}>
        <I18nProvider locale="pt-BR">
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </I18nProvider>
      </RouterProvider>
    </QueryClientProvider>
  );
}
