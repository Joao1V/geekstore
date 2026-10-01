import { describe, expect, it } from 'vitest';

import { assertNotSelfRoleChange, assertOwnerRemains } from './users.rules';

describe('users rules', () => {
  it('blocks changing your own role', () => {
    expect(() => assertNotSelfRoleChange('a', 'a')).toThrow();
    expect(() => assertNotSelfRoleChange('a', 'b')).not.toThrow();
  });

  it('never removes the last owner', () => {
    expect(() => assertOwnerRemains({ owners: ['a'], targetId: 'a', targetIsOwner: true })).toThrow(
      /último/
    );
    expect(() =>
      assertOwnerRemains({ owners: ['a', 'b'], targetId: 'a', targetIsOwner: true })
    ).not.toThrow();
    expect(() =>
      assertOwnerRemains({ owners: ['a'], targetId: 'c', targetIsOwner: false })
    ).not.toThrow();
  });
});
