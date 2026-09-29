'use client';

import { Button } from '@heroui/react';
import type { ReactNode } from 'react';

export function Action({
  children,
  onPress,
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onPress?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button type={type} onPress={onPress} isDisabled={disabled} className={`action ${className}`}>
      {children}
    </Button>
  );
}
