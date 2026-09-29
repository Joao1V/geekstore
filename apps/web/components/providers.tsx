'use client';

import { I18nProvider } from '@heroui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

import { getQueryClient } from '@/lib/get-query-client';

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="pt-BR">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </I18nProvider>
    </QueryClientProvider>
  );
}
