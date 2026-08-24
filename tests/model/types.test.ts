import { describe, expectTypeOf, test } from 'vitest';
import type { AttributeBag, CastType, Enum } from '../../src/main';

interface TypedAttributes {
    first_name: string;
    age: number;
}

describe('CastType', (): void => {
    test('accepts valid cast strings including parameterized decimals', (): void => {
        expectTypeOf<'int'>().toMatchTypeOf<CastType>();
        expectTypeOf<'datetime'>().toMatchTypeOf<CastType>();
        expectTypeOf<'decimal:2'>().toMatchTypeOf<CastType>();
        expectTypeOf<'nonsense'>().not.toMatchTypeOf<CastType>();
    });
});

describe('AttributeBag', (): void => {
    test('carries declared keys with autocomplete and accepts any extras', (): void => {
        const bag: AttributeBag<TypedAttributes> = { first_name: 'Ana', address: 'Elm Street' };

        expectTypeOf(bag['first_name']).toEqualTypeOf<unknown>();
        expectTypeOf<AttributeBag<TypedAttributes>>().toMatchTypeOf<Record<string, unknown>>();
    });
});

describe('Enum', (): void => {
    test('accepts string and numeric enum objects', (): void => {
        enum Status {
            Active = 'active',
        }

        enum Level {
            Low = 0,
        }

        expectTypeOf<typeof Status>().toMatchTypeOf<Enum>();
        expectTypeOf<typeof Level>().toMatchTypeOf<Enum>();
    });
});
