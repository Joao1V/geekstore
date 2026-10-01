import { describe, expect, it } from 'vitest';

import { movementDelta } from './stock-delta';

describe('movementDelta', () => {
  it('adds for inbound and return, subtracts for outbound', () => {
    expect(movementDelta('inbound', 5)).toBe(5);
    expect(movementDelta('return', 2)).toBe(2);
    expect(movementDelta('outbound', 3)).toBe(-3);
  });

  it('keeps the sign of adjustments', () => {
    expect(movementDelta('adjustment', 4)).toBe(4);
    expect(movementDelta('adjustment', -4)).toBe(-4);
  });
});
