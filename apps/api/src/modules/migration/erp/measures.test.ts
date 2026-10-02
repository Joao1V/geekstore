import { describe, expect, it } from 'vitest';

import { normalizeMeasures } from './measures';

const raw = (
  weightKg: number | null,
  height: number | null,
  width: number | null,
  length: number | null
) => ({
  weightKg,
  height,
  width,
  length,
});

describe('normalizeMeasures', () => {
  it('converts reliable kg/cm to g/mm', () => {
    expect(normalizeMeasures(raw(0.45, 18, 12, 14))).toEqual({
      weightG: 450,
      heightMm: 180,
      widthMm: 120,
      lengthMm: 140,
      issues: [],
    });
  });

  it('treats zeros and nulls as missing', () => {
    const result = normalizeMeasures(raw(0, 0, 0, 0));
    expect(result.weightG).toBeNull();
    expect(result.heightMm).toBeNull();
    expect(result.issues).toEqual(['weight_missing', 'dims_missing']);
  });

  it('drops the 1 kg + 1x1x1 cm placeholder pair', () => {
    const result = normalizeMeasures(raw(1, 1, 1, 1));
    expect(result.weightG).toBeNull();
    expect(result.issues).toEqual(['weight_placeholder', 'dims_placeholder']);
  });

  it('keeps a real 1 kg weight when the dimensions are not the placeholder', () => {
    expect(normalizeMeasures(raw(1, 20, 20, 10)).weightG).toBe(1000);
  });

  it('refuses dimensions whose unit is ambiguous (looks like meters)', () => {
    const result = normalizeMeasures(raw(0.3, 0.18, 0.11, 0.13));
    expect(result.weightG).toBe(300);
    expect(result.lengthMm).toBeNull();
    expect(result.issues).toEqual(['dims_suspect']);
  });
});
