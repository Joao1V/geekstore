'use client';

import { Button, Modal } from '@heroui/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Dialog({
  open,
  onChange,
  title,
  children,
  className = '',
}: {
  open: boolean;
  onChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Modal isOpen={open} onOpenChange={onChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className={`geek-dialog ${className}`}>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <Button isIconOnly aria-label="Fechar" onPress={() => onChange(false)}>
                <X size={20} />
              </Button>
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
