import { describe, expect, it } from 'vitest';

import { normalizeRedirectPath, redirectBodySchema, toDestinationPath } from './redirects';

describe('normalizeRedirectPath', () => {
  it('drops domain, query and anchor, lowercases and removes the trailing slash', () => {
    expect(normalizeRedirectPath('https://www.lojageekstore.com/Lego/Caixa/?x=1#topo')).toBe(
      '/lego/caixa'
    );
    expect(normalizeRedirectPath('lego/caixa/')).toBe('/lego/caixa');
    expect(normalizeRedirectPath('//lego///caixa')).toBe('/lego/caixa');
  });

  it('keeps the root as a single slash', () => {
    expect(normalizeRedirectPath('/')).toBe('/');
    expect(normalizeRedirectPath('https://x.com')).toBe('/');
  });

  it('decodes percent-encoded text and survives a broken escape', () => {
    expect(normalizeRedirectPath('/jogos/pok%C3%A9mon')).toBe('/jogos/pokémon');
    expect(normalizeRedirectPath('/jogos/100%')).toBe('/jogos/100%');
  });
});

describe('toDestinationPath', () => {
  it('always ends with a slash, the way the site writes its addresses', () => {
    expect(toDestinationPath('/lego/caixa')).toBe('/lego/caixa/');
    expect(toDestinationPath('https://loja.com/lego/')).toBe('/lego/');
    expect(toDestinationPath('/')).toBe('/');
  });
});

describe('redirectBodySchema', () => {
  it('normalizes both sides', () => {
    expect(
      redirectBodySchema.parse({ from_path: 'https://x.com/Old/Page/', to_path: '/novo/lugar' })
    ).toMatchObject({
      from_path: '/old/page',
      to_path: '/novo/lugar/',
    });
  });

  it('refuses the home page as origin and a destination that is not a store path', () => {
    expect(redirectBodySchema.safeParse({ from_path: '/', to_path: '/a/' }).success).toBe(false);
    expect(
      redirectBodySchema.safeParse({ from_path: '/a', to_path: 'javascript:alert(1)' }).success
    ).toBe(false);
    expect(redirectBodySchema.safeParse({ from_path: '/a', to_path: '//evil.com' }).success).toBe(
      false
    );
  });
});
