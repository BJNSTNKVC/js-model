import type { AttributeBag } from './types';

export class Attribute<T = unknown> {
    /**
     * Transform the raw value when the attribute is read.
     */
    get?: (value: unknown, attributes: AttributeBag) => T;

    /**
     * Transform the incoming value when written.
     */
    set?: (value: T, attributes: AttributeBag) => unknown;

    /**
     * Create a new attribute definition.
     */
    constructor(get?: (value: unknown, attributes: AttributeBag) => T, set?: (value: T, attributes: AttributeBag) => unknown) {
        this.get = get;
        this.set = set;
    }

    /**
     * Create a new attribute definition from get and set callbacks.
     */
    static make<T>(definition: { get?: (value: unknown, attributes: AttributeBag) => T; set?: (value: T, attributes: AttributeBag) => unknown }): Attribute<T> {
        return new Attribute<T>(definition.get, definition.set);
    }

    /**
     * Create a new get-only (accessor) attribute definition.
     */
    static get<T>(get: (value: unknown, attributes: AttributeBag) => T): Attribute<T> {
        return new Attribute<T>(get);
    }

    /**
     * Create a new set-only (mutator) attribute definition.
     */
    static set<T>(set: (value: T, attributes: AttributeBag) => unknown): Attribute<T> {
        return new Attribute<T>(undefined, set);
    }
}
