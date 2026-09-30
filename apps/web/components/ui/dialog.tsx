'use client';

import { Modal } from '@heroui/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

const SIZES = { md: 'max-w-[580px]', lg: 'max-w-[900px]' };

export function Dialog({
  open,
  onChange,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  size?: keyof typeof SIZES;
}) {
  return (
    <Modal isOpen={open} onOpenChange={onChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog
            className={`${SIZES[size]} relative w-full rounded-[20px] border border-border bg-surface text-foreground max-md:max-h-[90dvh]`}
          >
            <Modal.CloseTrigger
              aria-label="Fechar"
              className="size-10 rounded-[calc(var(--radius)*1.5)] bg-accent p-0 text-accent-foreground hover:bg-accent-hover"
            >
              <X size={20} />
            </Modal.CloseTrigger>
            <Modal.Header>
              <Modal.Heading className="font-display pr-8 text-3xl tracking-[0.02em]">
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="pb-5">{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
