'use client';

import { Button } from '@heroui/react';
import { Minus, Plus } from 'lucide-react';

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
