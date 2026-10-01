import type { StockMovementBody } from '@geekstore/shared';

/**
 * Delta com sinal aplicado ao `on_hand` por uma movimentação manual. `inbound`/`return` somam,
 * `outbound` subtrai (a quantidade do body é sempre positiva); `adjustment` já vem com sinal.
 */
export function movementDelta(type: StockMovementBody['type'], quantity: number): number {
  switch (type) {
    case 'inbound':
    case 'return':
      return Math.abs(quantity);
    case 'outbound':
      return -Math.abs(quantity);
    case 'adjustment':
      return quantity;
  }
}
