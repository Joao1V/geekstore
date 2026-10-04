'use client';

import type { CouponCheck } from '@geekstore/shared';
import { Button } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Quantity } from '@/components/ui';
import { formatBRL } from '../lib/money';
import { ProductImage } from '../product-image';
import { ShippingProgress } from '../shell';
import { useCartStore } from '../state/cart-store';
import { CHECKOUT_TITLE, TOTAL_ROW } from './constants';

const CENTS_PER_REAL = 100;

export type Totals = {
  subtotalCents: number;
  shippingCents: number | null;
  couponCents: number;
  pixCents: number;
  totalCents: number;
};

/** Resumo do carrinho com cupom e totais. O servidor refaz estas contas ao criar o pedido. */
export function Summary({
  totals,
  coupon,
  couponMessage,
  couponPending,
  onApplyCoupon,
  onRemoveCoupon,
}: {
  totals: Totals;
  coupon: CouponCheck | null;
  couponMessage: string;
  couponPending: boolean;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
}) {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.quantity);
  const [code, setCode] = useState('');

  return (
    <aside className="surface sticky top-[140px] p-[25px] max-md:static max-md:order-2">
      <h2 className={CHECKOUT_TITLE}>Resumo do carrinho</h2>
      <ShippingProgress total={totals.subtotalCents / CENTS_PER_REAL} />
      {lines.map((line) => (
        <div
          className="grid grid-cols-[54px_1fr_24px] gap-3 border-b border-border py-[18px]"
          key={line.sku_id}
        >
          <span className="block h-[67px] w-[54px] overflow-hidden rounded-lg">
            <ProductImage src={line.image_url} alt={line.name} />
          </span>
          <div>
            <strong className="block text-sm leading-[1.35]">{line.name}</strong>
            {line.variant && <small className="block text-xs text-muted">{line.variant}</small>}
            <span className="text-sm">{formatBRL(line.price_cents * line.qty)}</span>
            <Quantity
              size="compact"
              value={line.qty}
              max={line.max}
              onChange={(qty) => setQuantity(line.sku_id, qty)}
            />
          </div>
          <Button
            isIconOnly
            className="min-w-[22px] bg-transparent p-0 text-muted"
            aria-label={`Remover ${line.name}`}
            onPress={() => setQuantity(line.sku_id, 0)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}
      {coupon ? (
        <p className="mt-[23px] flex items-center justify-between gap-3 text-sm">
          <span>
            Cupom <strong>{coupon.code}</strong> aplicado
          </span>
          <button type="button" className="font-extrabold underline" onClick={onRemoveCoupon}>
            Remover
          </button>
        </p>
      ) : (
        <div className="mt-[23px] flex gap-1.5 text-sm">
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-[9px] text-foreground"
            aria-label="Cupom de desconto"
            placeholder="Cupom de desconto"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onApplyCoupon(code);
              }
            }}
          />
          <Button
            className="bg-surface-secondary font-extrabold text-foreground"
            isDisabled={couponPending || !code.trim()}
            onPress={() => onApplyCoupon(code)}
          >
            Aplicar
          </Button>
        </div>
      )}
      {couponMessage && (
        <p role="status" className="muted text-sm">
          {couponMessage}
        </p>
      )}
      <dl className="mt-[23px]">
        <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
          <dt>Subtotal</dt>
          <dd>{formatBRL(totals.subtotalCents)}</dd>
        </div>
        {totals.couponCents > 0 && (
          <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
            <dt>Cupom</dt>
            <dd>−{formatBRL(totals.couponCents)}</dd>
          </div>
        )}
        <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
          <dt>Frete</dt>
          <dd>
            {totals.shippingCents === null
              ? 'Informe o CEP'
              : totals.shippingCents === 0
                ? 'Grátis'
                : formatBRL(totals.shippingCents)}
          </dd>
        </div>
        {totals.pixCents > 0 && (
          <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
            <dt>Desconto Pix</dt>
            <dd>−{formatBRL(totals.pixCents)}</dd>
          </div>
        )}
        <div
          className={`${TOTAL_ROW} mt-3 border-t border-border pt-[18px] pb-[7px] text-2xl font-black`}
        >
          <dt>Total</dt>
          <dd>{formatBRL(totals.totalCents)}</dd>
        </div>
      </dl>
    </aside>
  );
}
