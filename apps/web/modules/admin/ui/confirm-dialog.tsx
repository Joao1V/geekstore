'use client';

import type { ReactNode } from 'react';

import { Action, Dialog } from '@/components/ui';

export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  isPending = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onChange={(next) => !next && onClose()} title={title}>
      <div className="grid gap-4">
        <div className="text-sm">{children}</div>
        {error && (
          <p className="error m-0" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Action className="action-outline" onPress={onClose}>
            Cancelar
          </Action>
          <Action className="action-black" onPress={onConfirm} disabled={isPending}>
            {isPending ? 'Aguarde…' : confirmLabel}
          </Action>
        </div>
      </div>
    </Dialog>
  );
}
