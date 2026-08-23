import { describe, expect, expectTypeOf, test } from 'vitest';
import { Attribute, type AttributeBag, type Attributes } from '../../src/main';

describe('Attribute.make', (): void => {
    test('wires both callbacks onto the definition', (): void => {
        const accessor: (value: unknown, attributes: AttributeBag) => string = (value: unknown): string => String(value);
        const mutator: (value: string, attributes: AttributeBag) => unknown = (value: string): unknown => value.toLowerCase();
        const made: Attribute<string> = Attribute.make<string>({ get: accessor, set: mutator });

        expect(made).toBeInstanceOf(Attribute);
        expect(made.get).toBe(accessor);
        expect(made.set).toBe(mutator);
    });
});

describe('Attribute.get', (): void => {
    test('creates a get-only definition', (): void => {
        const accessor: (value: unknown, attributes: AttributeBag) => string = (value: unknown): string => String(value);

        expect(Attribute.get(accessor).get).toBe(accessor);
        expect(Attribute.get(accessor).set).toBeUndefined();
    });
});

describe('Attribute.set', (): void => {
    test('creates a set-only definition', (): void => {
        const mutator: (value: string, attributes: AttributeBag) => unknown = (value: string): unknown => value.toLowerCase();

        expect(Attribute.set(mutator).set).toBe(mutator);
        expect(Attribute.set(mutator).get).toBeUndefined();
    });

    test('types the definition map against the attribute class', (): void => {
        interface TypedAttributes {
            first_name: string;
            age: number;
        }

        const definitions: Attributes<TypedAttributes> = {
            first_name: Attribute.set<string>((value: string): unknown => value.toLowerCase()),
        };

        expectTypeOf(definitions.first_name).toEqualTypeOf<Attribute<string> | undefined>();
        expectTypeOf<Attributes<TypedAttributes>['age']>().toEqualTypeOf<Attribute<number> | undefined>();
    });
});
