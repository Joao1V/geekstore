'use client';

import { Button, Tooltip } from '@heroui/react';
import type { ReactNode } from 'react';

const SIZES = { md: 'size-9 min-w-9', sm: 'size-8 min-w-8' };
const DANGER = 'text-status-error hover:border-status-error';

/** Botão só de ícone (editar, apagar, subir...): `label` é o nome acessível, obrigatório. */
export function IconAction({
  label,
  onPress,
  disabled = false,
  tone = 'default',
  size = 'md',
  className = '',
  children,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip delay={400}>
      <Button
        isIconOnly
        variant="outline"
        aria-label={label}
        onPress={onPress}
        isDisabled={disabled}
        className={`${SIZES[size]} rounded-lg ${tone === 'danger' ? DANGER : 'hover:border-ink'} ${className}`}
      >
        {children}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/** Botão com cara de link (ações pequenas dentro de textos e barras). */
export function LinkAction({
  onPress,
  disabled = false,
  className = '',
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      isDisabled={disabled}
      className={`h-auto min-w-0 p-0 text-xs font-extrabold underline ${className}`}
    >
      {children}
    </Button>
  );
}
