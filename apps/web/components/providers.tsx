'use client';

import { I18nProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60000, retry: 1 } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="pt-BR">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </I18nProvider>
    </QueryClientProvider>
  );
}
