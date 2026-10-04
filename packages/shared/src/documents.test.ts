import { describe, expect, it } from 'vitest';

import { formatDocument, isValidCnpj, isValidCpf, isValidDocument, onlyDigits } from './documents';

describe('CPF', () => {
  it('accepts valid CPFs with or without punctuation', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('refuses a wrong check digit, wrong size and repeated digits', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('CNPJ', () => {
  it('accepts a valid CNPJ and refuses an invalid one', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
});

describe('document helpers', () => {
  it('validates either kind and formats it', () => {
    expect(isValidDocument('52998224725')).toBe(true);
    expect(isValidDocument('11222333000181')).toBe(true);
    expect(isValidDocument('123')).toBe(false);
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatDocument('abc')).toBe('abc');
  });
});
