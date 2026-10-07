import { describe, expect, it } from 'vitest';

import { maskDocument, maskPhone } from './masks';

describe('maskDocument', () => {
  it('formats CPF while typing and CNPJ after 11 digits', () => {
    expect(maskDocument('529')).toBe('529');
    expect(maskDocument('5299')).toBe('529.9');
    expect(maskDocument('52998224725')).toBe('529.982.247-25');
    expect(maskDocument('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskDocument('abc')).toBe('');
  });
});

describe('maskPhone', () => {
  it('formats landline and mobile numbers', () => {
    expect(maskPhone('')).toBe('');
    expect(maskPhone('1')).toBe('(1');
    expect(maskPhone('11999')).toBe('(11) 999');
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
    expect(maskPhone('119999988889999')).toBe('(11) 99999-8888');
  });
});
