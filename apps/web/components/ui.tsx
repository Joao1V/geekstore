'use client';

import { Button, Input, Label, Modal, TextField } from '@heroui/react';
import { Minus, Plus, X } from 'lucide-react';
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

export function Price({ value }: { value: number }) {
  const [whole, cents] = value.toFixed(2).split('.');
  return (
    <span className="price">
      <span className="sr-only">{`R$ ${whole},${cents}`}</span>
      <span aria-hidden="true">
        <small>R$</small> {Number(whole).toLocaleString('pt-BR')}
        <sup>{cents}</sup>
      </span>
    </span>
  );
}

export function Quantity({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  return (
    <div className="quantity">
      <Button
        isIconOnly
        aria-label="Diminuir quantidade"
        isDisabled={value <= 1}
        onPress={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </Button>
      <span aria-live="polite">{value}</span>
      <Button
        isIconOnly
        aria-label="Aumentar quantidade"
        isDisabled={value >= max}
        onPress={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}

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

export function Field({
  label,
  name,
  type = 'text',
  required = true,
  autoComplete,
  pattern,
  minLength,
}: {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  required?: boolean;
  autoComplete?: string;
  pattern?: string;
  minLength?: number;
}) {
  return (
    <TextField name={name} type={type} isRequired={required} className="form-field">
      <Label>{label}</Label>
      <Input
        autoComplete={autoComplete}
        pattern={pattern}
        minLength={minLength}
        className="field-input"
      />
    </TextField>
  );
}
