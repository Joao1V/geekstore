import { Prisma } from '@geekstore/db';
import { describe, expect, it } from 'vitest';

import { asInt, asUuid, compactText, matchesSearch, utcNow } from './sql';

describe('sql helpers', () => {
  it('casts ids and integers explicitly', () => {
    expect(asUuid('abc').text).toBe('$1::uuid');
    expect(asInt(3).text).toBe('$1::int');
  });

  it('compacts text: no accents, no case, no punctuation', () => {
    expect(compactText('R.P.G')).toBe('rpg');
    expect(compactText('Coleção Pokémon, Edição #2')).toBe('colecaopokemonedicao2');
    expect(compactText(' . - ')).toBe('');
  });

  it('requires every word of the term, in any of the columns, with bound patterns', () => {
    const fragment = matchesSearch([Prisma.sql`p.name`, Prisma.sql`p.code`], 'R.P.G dado');
    expect(fragment.values).toEqual(['%rpg%', '%rpg%', '%dado%', '%dado%']);
    expect(fragment.text).toContain(' AND ');
    expect(fragment.text).toContain(
      "regexp_replace(lower(unaccent(p.name)), '[^a-z0-9]', '', 'g') LIKE $1"
    );
  });

  it('does not filter on a term that is only punctuation', () => {
    expect(matchesSearch([Prisma.sql`p.name`], ' . - ').text).toBe('TRUE');
  });

  it('uses UTC for "now"', () => {
    expect(utcNow.text).toContain("AT TIME ZONE 'UTC'");
  });
});
