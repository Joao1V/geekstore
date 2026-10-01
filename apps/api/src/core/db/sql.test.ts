import { Prisma } from '@geekstore/db';
import { describe, expect, it } from 'vitest';

import { asInt, asUuid, containsInsensitive, escapeLike, utcNow } from './sql';

describe('sql helpers', () => {
  it('casts ids and integers explicitly', () => {
    expect(asUuid('abc').text).toBe('$1::uuid');
    expect(asInt(3).text).toBe('$1::int');
  });

  it('escapes LIKE wildcards so user input stays literal', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x');
  });

  it('builds an accent- and case-insensitive contains with a bound pattern', () => {
    const fragment = containsInsensitive(Prisma.sql`p.name`, 'acessó%');
    expect(fragment.text).toBe('unaccent(p.name) ILIKE unaccent($1)');
    expect(fragment.values).toEqual(['%acessó\\%%']);
  });

  it('uses UTC for "now"', () => {
    expect(utcNow.text).toContain("AT TIME ZONE 'UTC'");
  });
});
