import { Chip } from '@heroui/react';
import type { ReactNode } from 'react';

const TONES = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'accent',
  neutral: 'default',
} as const;

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <Chip
      color={TONES[tone]}
      variant="soft"
      size="sm"
      className="rounded-md text-2xs font-extrabold tracking-wide whitespace-nowrap uppercase"
    >
      {children}
    </Chip>
  );
}
