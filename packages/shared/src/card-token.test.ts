import { describe, expect, it } from 'vitest';

import { isFutureExpiry, mockCardToken, passesLuhn } from './card-token';

describe('mockCardToken', () => {
  it('turns a valid test card into a token that carries only the last 4 digits', () => {
    expect(mockCardToken('4242 4242 4242 4242')).toBe('mock_tok_approved_4242');
    expect(mockCardToken('4000000000000002')).toBe('mock_tok_declined_0002');
  });

  it('refuses a wrong check digit, a short number and junk', () => {
    expect(mockCardToken('4242 4242 4242 4243')).toBeNull();
    expect(mockCardToken('4242')).toBeNull();
    expect(mockCardToken('abcd')).toBeNull();
  });

  it('checks the Luhn digit', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4242424242424241')).toBe(false);
  });
});

describe('isFutureExpiry', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('accepts this month and later, refuses the past and bad months', () => {
    expect(isFutureExpiry('10/26', now)).toBe(true);
    expect(isFutureExpiry('01/30', now)).toBe(true);
    expect(isFutureExpiry('09/26', now)).toBe(false);
    expect(isFutureExpiry('13/30', now)).toBe(false);
    expect(isFutureExpiry('1/3', now)).toBe(false);
  });
});
