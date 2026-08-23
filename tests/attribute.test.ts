import { describe, expect, expectTypeOf, it } from 'vitest';
import { attr, type Attribute, type Attributes } from '../src/attribute';

describe('attr', () => {
  it('returns the definition unchanged', () => {
    const definition: Attribute<string> = { get: (value: unknown): string => String(value) };
    expect(attr(definition)).toBe(definition);
  });

  it('types the definition map against the attribute interface', () => {
    interface UserAttributes {
      first_name: string;
      age: number;
    }
    const definitions: Attributes<UserAttributes> = {
      first_name: attr<string>({ set: (value: string): unknown => value.toLowerCase() }),
    };
    expectTypeOf(definitions.first_name).toEqualTypeOf<Attribute<string> | undefined>();
    expectTypeOf<Attributes<UserAttributes>['age']>().toEqualTypeOf<Attribute<number> | undefined>();
  });
});
