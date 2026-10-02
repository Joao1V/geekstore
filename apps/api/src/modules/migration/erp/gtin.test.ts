import { describe, expect, it } from 'vitest';

import { isValidGtin } from './gtin';

describe('isValidGtin', () => {
  it('accepts real EAN-13, UPC-A and EAN-8 codes', () => {
    expect(isValidGtin('7898572679235')).toBe(true);
    expect(isValidGtin('027084120134')).toBe(true);
    expect(isValidGtin('96385074')).toBe(true);
  });

  it('rejects a wrong check digit, odd lengths, placeholders and text', () => {
    expect(isValidGtin('7898572679234')).toBe(false);
    expect(isValidGtin('78985726792')).toBe(false);
    expect(isValidGtin('0000000000000')).toBe(false);
    expect(isValidGtin('SEM GTIN')).toBe(false);
    expect(isValidGtin('1')).toBe(false);
  });
});
