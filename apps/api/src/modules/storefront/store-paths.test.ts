import { describe, expect, it } from 'vitest';

import { buildCategoryPaths } from './store-paths';

const paths = buildCategoryPaths([
  { category_id: 'c1', parent_id: null, slug: 'colecionaveis' },
  { category_id: 'c2', parent_id: 'c1', slug: 'funko' },
  { category_id: 'c3', parent_id: 'c2', slug: 'marvel' },
  { category_id: 'c4', parent_id: null, slug: 'lego' },
]);

describe('buildCategoryPaths', () => {
  it('builds the category and product address from the chain of slugs', () => {
    expect(paths.categoryPath('c2')).toBe('/colecionaveis/funko/');
    expect(paths.productPath('c3', 'pop-wolverine')).toBe(
      '/colecionaveis/funko/marvel/pop-wolverine/'
    );
    expect(paths.productPath('c4', 'caixa')).toBe('/lego/caixa/');
  });

  it('finds a category by its exact chain, and not by a wrong one', () => {
    expect(paths.idOfChain(['colecionaveis', 'funko'])).toBe('c2');
    expect(paths.idOfChain(['funko'])).toBeNull();
    expect(paths.idOfChain(['lego', 'funko'])).toBeNull();
  });

  it('finds a category by its last slug, to recover the canonical address', () => {
    expect(paths.idOfSlug('funko')).toBe('c2');
    expect(paths.idOfSlug('nao-existe')).toBeNull();
  });
});
