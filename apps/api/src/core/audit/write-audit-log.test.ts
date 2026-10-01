import { describe, expect, it } from 'vitest';

import { toAuditJson } from './write-audit-log';

describe('toAuditJson', () => {
  it('drops null/undefined and serializes dates to ISO strings', () => {
    expect(toAuditJson(null)).toBeUndefined();
    expect(toAuditJson(undefined)).toBeUndefined();
    expect(toAuditJson({ at: new Date('2026-01-01T00:00:00.000Z'), n: 1 })).toEqual({
      at: '2026-01-01T00:00:00.000Z',
      n: 1,
    });
  });
});
