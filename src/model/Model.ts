import type { Attribute } from './Attribute';
import type { AttributeBag, Attributes, Cast, Casts, CastType, Enum, Key, Related, Relations } from './types';

const KNOWN: readonly string[] = [
    'int',
    'integer',
    'float',
    'double',
    'number',
    'string',
    'bool',
    'boolean',
    'json',
    'array',
    'object',
    'date',
    'datetime',
    'timestamp',
];

export abstract class Model<A = AttributeBag> {
    /**
     * The raw attribute values keyed by attribute name.
     */
    protected attributes: AttributeBag;

    /**
     * The last-synced snapshot of the raw attributes.
     */
    protected originals: AttributeBag;

    /**
     * Memoized object results of cast reads, invalidated on writes.
     */
    protected memo: Map<string, unknown>;

    /**
     * Create a new model instance.
     */
    constructor(attributes: Partial<A> & AttributeBag = {}) {
        this.attributes = {};
        this.originals = {};
        this.memo = new Map<string, unknown>();

        this.fill(this.defaults());
        this.sync();
        this.fill(attributes);

        return new Proxy(this, this.proxy() as ProxyHandler<this>) as this;
    }

    /**
     * Create a model from trusted raw data, bypassing mutators, synced clean.
     */
    static hydrate<T extends Model<any>>(this: new () => T, attributes: AttributeBag): T {
        const model: T = new this();

        model.attributes = { ...attributes };

        return model.sync();
    }

    /**
     * Get an attribute value, applying accessors and casts.
     */
    get<K extends keyof A & string>(key: K): A[K];
    get(key: string): unknown;
    get(key: string): unknown {
        return this.transform(key, this.attributes, this.memo);
    }

    /**
     * Set an attribute value, applying mutators and cast normalization.
     */
    set<K extends keyof A & string>(key: K, value: A[K]): this;
    set(key: string, value: unknown): this;
    set(key: string, value: unknown): this {
        this.memo.delete(key);

        // Indexing the mapped config types by a plain string needs a widened view.
        const definition: Attribute | undefined = (this.mutators() as Record<string, Attribute | undefined>)[key];

        if (definition !== undefined && definition.set !== undefined) {
            const result: unknown = definition.set(value, this.attributes);

            if (this.plain(result)) {
                for (const [written, raw] of Object.entries(result)) {
                    this.attributes[written] = raw;
                    this.memo.delete(written);
                }
            } else {
                this.attributes[key] = result;
            }

            return this;
        }

        const cast: CastType | Cast | Enum | undefined = (this.casts() as Record<string, CastType | Cast | Enum | undefined>)[key];

        if (cast !== undefined) {
            this.attributes[key] = this.normalize(cast, value, key, this.attributes);

            return this;
        }

        this.attributes[key] = value;

        return this;
    }

    /**
     * Mass assign the given attributes.
     */
    fill(attributes: Partial<A> & AttributeBag): this {
        for (const [key, value] of Object.entries(attributes)) {
            this.set(key, value);
        }

        return this;
    }

    /**
     * Get a copy of the raw stored attributes, or a single raw value.
     */
    raw(): AttributeBag<A>;
    raw(key: Key<A>): unknown;
    raw(key?: string): unknown {
        return key === undefined ? { ...this.attributes } : this.attributes[key];
    }

    /**
     * Determine whether an attribute is present, raw or virtual.
     */
    has(key: string): boolean {
        const definition: Attribute | undefined = (this.mutators() as Record<string, Attribute | undefined>)[key];

        return Object.hasOwn(this.attributes, key) || (definition !== undefined && definition.get !== undefined);
    }

    /**
     * Remove an attribute from raw storage.
     */
    forget(key: Key<A>): this {
        delete this.attributes[key];
        this.memo.delete(key);

        return this;
    }

    /**
     * Snapshot the current raw attributes as the original state.
     */
    sync(): this {
        this.originals = this.snapshot(this.attributes) as AttributeBag;
        this.memo.clear();

        return this;
    }

    /**
     * Determine whether any (or any of the given) attributes changed since the last sync.
     */
    dirty(...keys: Key<A>[]): boolean {
        const changed: AttributeBag<A> = this.changes();

        if (keys.length === 0) {
            return Object.keys(changed).length > 0;
        }

        return keys.some((key: string): boolean => Object.hasOwn(changed, key));
    }

    /**
     * Get the raw attributes that changed since the last sync.
     */
    changes(): AttributeBag<A> {
        const changed: AttributeBag = {};

        for (const [key, value] of Object.entries(this.attributes)) {
            if (!Object.hasOwn(this.originals, key) || !this.equivalent(value, this.originals[key])) {
                changed[key] = value;
            }
        }

        return changed;
    }

    /**
     * Get the original (last-synced) attributes with casts applied, or one of them.
     */
    original(): AttributeBag<A>;
    original(key: Key<A>): unknown;
    original(key?: string): unknown {
        if (key !== undefined) {
            return this.transform(key, this.originals);
        }

        const output: AttributeBag = {};

        for (const name of Object.keys(this.originals)) {
            output[name] = this.transform(name, this.originals);
        }

        return output;
    }

    /**
     * Get a copy of the raw original attributes, or a single raw original value.
     */
    rawOriginal(): AttributeBag<A>;
    rawOriginal(key: Key<A>): unknown;
    rawOriginal(key?: string): unknown {
        return key === undefined ? { ...this.originals } : this.originals[key];
    }

    /**
     * Copy the model into a fresh unsaved instance, excluding the given keys.
     */
    replicate(...except: Key<A>[]): this {
        const model: this = new (this.constructor as new () => this)();
        const attributes: AttributeBag = this.snapshot(this.attributes) as AttributeBag;

        for (const key of except) {
            delete attributes[key];
        }

        model.attributes = attributes;

        return model;
    }

    /**
     * Revert the raw attributes to the last-synced original state.
     */
    discard(): this {
        this.attributes = this.snapshot(this.originals) as AttributeBag;
        this.memo.clear();

        return this;
    }

    /**
     * Serialize the model to a plain object, applying casts, accessors, appends, and visibility.
     */
    toJSON(): AttributeBag<A> {
        const output: AttributeBag = {};

        for (const key of Object.keys(this.attributes)) {
            output[key] = this.transform(key, this.attributes, this.memo);
        }

        return output;
    }

    /**
     * Get a cast-applied subset of the attributes.
     */
    only<K extends keyof A & string>(...keys: K[]): Pick<A, K> {
        const output: AttributeBag = {};

        for (const key of keys) {
            output[key] = this.get(key);
        }

        return output as Pick<A, K>;
    }

    /**
     * Get all cast-applied attributes except the given keys.
     */
    except(...keys: Key<A>[]): AttributeBag<A> {
        const output: AttributeBag = {};

        for (const key of Object.keys(this.attributes)) {
            if (!keys.includes(key)) {
                output[key] = this.transform(key, this.attributes, this.memo);
            }
        }

        return output;
    }

    /**
     * Get the attributes that should be cast.
     */
    casts(): Casts<A> {
        return {};
    }

    /**
     * Get the accessor and mutator definitions.
     */
    mutators(): Attributes<A> {
        return {};
    }

    /**
     * Get the related model definitions.
     */
    relations(): Relations<A> {
        return {};
    }

    /**
     * Get the default attribute values.
     */
    defaults(): Partial<A> {
        return {};
    }

    /**
     * Apply the accessor/cast get pipeline for one key against the given raw bag.
     */
    protected transform(key: string, attributes: AttributeBag, memo?: Map<string, unknown>): unknown {
        const definition: Attribute | undefined = (this.mutators() as Record<string, Attribute | undefined>)[key];

        if (definition !== undefined && definition.get !== undefined) {
            if (definition.cached && memo !== undefined && memo.has(key)) {
                return memo.get(key);
            }

            const computed: unknown = definition.get(attributes[key], attributes);

            if (definition.cached && memo !== undefined) {
                memo.set(key, computed);
            }

            return computed;
        }

        const relation: Related | undefined = (this.relations() as Record<string, Related | undefined>)[key];

        if (relation !== undefined) {
            if (memo !== undefined && memo.has(key)) {
                return memo.get(key);
            }

            const related: unknown = this.relate(relation, attributes[key]);

            if (memo !== undefined && related !== null && related !== undefined) {
                memo.set(key, related);
            }

            return related;
        }

        const cast: CastType | Cast | Enum | undefined = (this.casts() as Record<string, CastType | Cast | Enum | undefined>)[key];

        if (cast !== undefined) {
            if (memo !== undefined && memo.has(key)) {
                return memo.get(key);
            }

            const value: unknown = this.cast(cast, attributes[key], key, attributes);

            if (memo !== undefined && typeof value === 'object' && value !== null) {
                memo.set(key, value);
            }

            return value;
        }

        return attributes[key];
    }

    /**
     * Hydrate a raw value into its related model or models.
     */
    protected relate(relation: Related, value: unknown): unknown {
        if (value === null || value === undefined) {
            return value;
        }

        // An attribute bag is always a plain object, so an array value can only mean a one to many relation.
        if (Array.isArray(value)) {
            return value.map((entry: unknown): unknown => this.relate(relation, entry));
        }

        if (value instanceof relation) {
            return value;
        }

        const model: Model<any> = new relation();

        // Mirrors hydrate(): full raw replacement, synced clean.
        model.attributes = { ...(value as AttributeBag) };

        return model.sync();
    }

    /**
     * Cast a raw value for reading.
     */
    protected cast(cast: CastType | Cast | Enum, value: unknown, key: string, attributes: AttributeBag): unknown {
        if (this.caster(cast)) {
            return cast.get(value, key, attributes);
        }

        if (typeof cast === 'object') {
            return this.enumerate(cast, value, key);
        }

        if (value === null || value === undefined) {
            this.validate(cast, key);

            return value;
        }

        if (cast.startsWith('decimal:')) {
            return this.decimal(cast, value, key);
        }

        switch (cast) {
            case 'int':
            case 'integer':
                return Math.trunc(Number(value));
            case 'float':
            case 'double':
            case 'number':
                return Number(value);
            case 'string':
                return String(value);
            case 'bool':
            case 'boolean':
                return this.truthy(value);
            case 'json':
            case 'array':
            case 'object':
                return typeof value === 'string' ? JSON.parse(value) : value;
            case 'date':
                return this.asDate(value);
            case 'datetime':
                return this.asDateTime(value);
            case 'timestamp':
                return this.asTimestamp(value);
            default:
                throw new TypeError(`Unknown cast type [${cast as string}] for attribute [${key}].`);
        }
    }

    /**
     * Normalize a value into its raw storage form for writing.
     */
    protected normalize(cast: CastType | Cast | Enum, value: unknown, key: string, attributes: AttributeBag): unknown {
        if (this.caster(cast)) {
            return cast.set(value, key, attributes);
        }

        if (typeof cast === 'object') {
            return this.enumerate(cast, value, key);
        }

        this.validate(cast, key);

        if (value === null || value === undefined) {
            return value;
        }

        switch (cast) {
            case 'date':
            case 'datetime':
                return value instanceof Date ? value.toISOString() : value;
            case 'timestamp':
                return this.asTimestamp(value);
            default:
                return value;
        }
    }

    /**
     * Determine whether a cast definition is a custom cast instance.
     */
    protected caster(cast: CastType | Cast | Enum): cast is Cast {
        return typeof cast === 'object' && typeof (cast as Cast).get === 'function';
    }

    /**
     * Validate a raw value against the given enum definition.
     */
    protected enumerate(definition: Enum, value: unknown, key: string): string | number | null | undefined {
        if (value === null || value === undefined) {
            return value;
        }

        // Numeric enums carry reverse mappings; only non-numeric keys hold the actual values.
        const values: (string | number)[] = Object.keys(definition)
            .filter((name: string): boolean => Number.isNaN(Number(name)))
            .map((name: string): string | number => definition[name] as string | number);

        if (values.includes(value as string | number)) {
            return value as string | number;
        }

        throw new TypeError(`Invalid enum value [${String(value)}] for attribute [${key}].`);
    }

    /**
     * Throw when a cast string is not a recognized built-in.
     */
    protected validate(cast: string, key: string): void {
        if (cast.startsWith('decimal:')) {
            this.places(cast, key);

            return;
        }

        if (KNOWN.includes(cast)) {
            return;
        }

        throw new TypeError(`Unknown cast type [${cast}] for attribute [${key}].`);
    }

    /**
     * Parse and validate the precision of a decimal cast string.
     */
    protected places(cast: string, key: string): number {
        const precision: number = Number(cast.slice('decimal:'.length));

        if (Number.isInteger(precision) && precision >= 0) {
            return precision;
        }

        throw new TypeError(`Invalid decimal precision in cast [${cast}] for attribute [${key}].`);
    }

    /**
     * Format a numeric value as a fixed-decimal string, e.g. decimal:2 → "3.14".
     */
    protected decimal(cast: string, value: unknown, key: string): string {
        return Number(value).toFixed(this.places(cast, key));
    }

    /**
     * Coerce a raw value to boolean using PHP-like semantics.
     */
    protected truthy(value: unknown): boolean {
        return value === false || value === 0 || value === '0' || value === '' || value === 'false'
            ? false
            : Boolean(value);
    }

    /**
     * Parse a raw value into a Date at local start of day.
     */
    protected asDate(value: unknown): Date {
        const parsed: Date = this.asDateTime(value);

        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    /**
     * Parse a raw value into a Date.
     */
    protected asDateTime(value: unknown): Date {
        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
            return new Date(Number(value) * 1000);
        }

        return new Date(value as string);
    }

    /**
     * Convert a raw value into unix seconds.
     */
    protected asTimestamp(value: unknown): number {
        if (value instanceof Date) {
            return Math.floor(value.getTime() / 1000);
        }

        if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
            return Math.trunc(Number(value));
        }

        return Math.floor(new Date(value as string).getTime() / 1000);
    }

    /**
     * Determine whether a value is a plain object, i.e. a multi-attribute mutator result.
     */
    protected plain(value: unknown): value is AttributeBag {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const prototype: object | null = Object.getPrototypeOf(value) as object | null;

        return prototype === Object.prototype || prototype === null;
    }

    /**
     * Deep-copy plain data for a snapshot, carrying exotic values by reference.
     */
    protected snapshot(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((entry: unknown): unknown => this.snapshot(entry));
        }

        if (this.plain(value)) {
            const copied: AttributeBag = {};

            for (const [key, entry] of Object.entries(value)) {
                copied[key] = this.snapshot(entry);
            }

            return copied;
        }

        return value;
    }

    /**
     * Compare a current and original raw value for dirty tracking.
     */
    protected equivalent(current: unknown, original: unknown): boolean {
        if (Object.is(current, original)) {
            return true;
        }

        if ((this.plain(current) || Array.isArray(current)) && (this.plain(original) || Array.isArray(original))) {
            return JSON.stringify(current) === JSON.stringify(original);
        }

        return false;
    }

    /**
     * Create the proxy handler that routes unknown properties to attribute access.
     */
    protected proxy(): ProxyHandler<Model<A>> {
        return {
            /**
             * Route reads of unknown properties through the model's attribute getter.
             */
            get(target: Model<A>, property: string | symbol, receiver: unknown): unknown {
                if (typeof property === 'symbol' || property in target) {
                    return Reflect.get(target, property, receiver);
                }

                return target.get(property);
            },

            /**
             * Route writes of unknown properties through the model's attribute setter.
             */
            set(target: Model<A>, property: string | symbol, value: unknown, receiver: unknown): boolean {
                if (typeof property === 'symbol' || property in target) {
                    return Reflect.set(target, property, value, receiver);
                }

                target.set(property, value);

                return true;
            },

            /**
             * Report attribute presence for the `in` operator.
             */
            has(target: Model<A>, property: string | symbol): boolean {
                if (typeof property === 'symbol') {
                    return property in target;
                }

                if (property in target) {
                    return true;
                }

                return target.has(property);
            },

            /**
             * Remove an attribute when an unknown property is deleted.
             */
            deleteProperty(target: Model<A>, property: string | symbol): boolean {
                if (typeof property === 'symbol' || property in target) {
                    return Reflect.deleteProperty(target, property);
                }

                target.forget(property);

                return true;
            },

            /**
             * Enumerate attribute keys for Object.keys, spread, and for-in loops.
             */
            ownKeys(target: Model<A>): (string | symbol)[] {
                return Object.keys(target.attributes);
            },

            /**
             * Describe attributes as enumerable properties during enumeration.
             */
            getOwnPropertyDescriptor(target: Model<A>, property: string | symbol): PropertyDescriptor | undefined {
                if (typeof property === 'symbol' || property in target) {
                    return Reflect.getOwnPropertyDescriptor(target, property);
                }

                if (Object.hasOwn(target.attributes, property)) {
                    // Spread reads values through the get trap; the raw value here only backs the descriptor.
                    return { value: target.raw(property), writable: true, enumerable: true, configurable: true };
                }

                return undefined;
            },
        };
    }
}
