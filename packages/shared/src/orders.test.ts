import { describe, expect, it } from 'vitest';

import { displayStatusOf } from './orders';

const state = (
  status: 'open' | 'completed' | 'cancelled',
  payment: 'pending' | 'approved',
  fulfillment: 'not_picked' | 'picking' | 'partially_shipped' | 'shipped' | 'delivered'
) => displayStatusOf({ status, payment_status: payment, fulfillment_status: fulfillment });

describe('displayStatusOf', () => {
  it('derives what the customer sees from the three independent states', () => {
    expect(state('open', 'pending', 'not_picked')).toBe('awaiting_payment');
    expect(state('open', 'approved', 'not_picked')).toBe('paid');
    expect(state('open', 'approved', 'picking')).toBe('picking');
    expect(state('open', 'approved', 'partially_shipped')).toBe('shipped');
    expect(state('open', 'approved', 'shipped')).toBe('shipped');
    expect(state('completed', 'approved', 'delivered')).toBe('delivered');
  });

  it('cancelled wins over everything else', () => {
    expect(state('cancelled', 'approved', 'not_picked')).toBe('cancelled');
    expect(state('cancelled', 'pending', 'picking')).toBe('cancelled');
  });
});
