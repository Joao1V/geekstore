'use client';

import { Button } from '@heroui/react';
import { Minus, Plus } from 'lucide-react';

const ROOT =
  'mt-[5px] items-center overflow-hidden rounded-[9px] border border-border bg-surface text-foreground';
const SIZES = {
  md: { root: `${ROOT} inline-flex h-[37px]`, button: 'h-[35px]', value: 'text-sm' },
  compact: { root: `${ROOT} flex h-[30px] w-max`, button: 'h-7', value: 'text-[13px]' },
};

export function Quantity({
  value,
  max,
  onChange,
  size = 'md',
}: {
  value: number;
  max: number;
  onChange: (qty: number) => void;
  size?: keyof typeof SIZES;
}) {
  const styles = SIZES[size];
  const buttonClass = `${styles.button} w-8 min-w-8 bg-transparent p-0 text-inherit`;
  return (
    <div className={styles.root}>
      <Button
        isIconOnly
        className={buttonClass}
        aria-label="Diminuir quantidade"
        isDisabled={value <= 1}
        onPress={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </Button>
      <span className={`w-[30px] text-center font-extrabold ${styles.value}`} aria-live="polite">
        {value}
      </span>
      <Button
        isIconOnly
        className={buttonClass}
        aria-label="Aumentar quantidade"
        isDisabled={value >= max}
        onPress={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}
