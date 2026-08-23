import { describe, expectTypeOf, it } from 'vitest';
import type { AttributeBag, CastType } from '../src/types';

describe('types', () => {
  it('accepts valid cast strings including parameterized decimals', () => {
    expectTypeOf<'int'>().toMatchTypeOf<CastType>();
    expectTypeOf<'datetime'>().toMatchTypeOf<CastType>();
    expectTypeOf<'decimal:2'>().toMatchTypeOf<CastType>();
    expectTypeOf<'nonsense'>().not.toMatchTypeOf<CastType>();
  });

  it('treats an attribute bag as string-keyed unknowns', () => {
    expectTypeOf<AttributeBag>().toEqualTypeOf<Record<string, unknown>>();
  });
});
