import type { ReactNode } from 'react';

const TONES = {
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-status-warning/15 text-status-warning',
  error: 'bg-status-error/15 text-status-error',
  info: 'bg-status-info/15 text-status-info',
  neutral: 'bg-surface-secondary text-muted',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`${TONES[tone]} inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-extrabold tracking-wide whitespace-nowrap uppercase`}
    >
      {children}
    </span>
  );
}
