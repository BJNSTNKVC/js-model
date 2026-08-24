import { describe, expect, test } from 'vitest';
import {
    Attribute,
    type AttributeBag,
    type Attributes,
    type Cast,
    type Casts,
    type Relations,
    Model,
} from '../../src/main';

interface UserAttributes {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    age: number;
    meta: { tags: string[] };
    created_at: Date;
    fullName: string;
}

class User extends Model<UserAttributes> {
    /**
     * Get the attributes that should be cast.
     */
    override casts(): Casts<UserAttributes> {
        return {
            id        : 'int',
            age       : 'int',
            meta      : 'json',
            created_at: 'datetime',
        };
    }

    /**
     * Get the accessor and mutator definitions.
     */
    override mutators(): Attributes<UserAttributes> {
        return {
            fullName: Attribute.make<string>({
                get: (_value: unknown, attributes: AttributeBag<UserAttributes>): string => `${String(attributes['first_name'])} ${String(attributes['last_name'])}`,
                set: (value: string): unknown => {
                    const [first, last]: string[] = value.split(' ');

                    return { first_name: first, last_name: last };
                },
            }),
            email   : Attribute.set<string>((value: string): unknown => value.toLowerCase()),
        };
    }

    /**
     * Get the default attribute values.
     */
    override defaults(): Partial<UserAttributes> {
        return { age: 18 };
    }
}

interface User extends UserAttributes {
}

class Open extends Model {
}

interface ItemAttributes {
    name: string;
    price: number;
    meta: { tags: string[] };
    created_at: Date;
}

class Item extends Model<ItemAttributes> {
    /**
     * Get the attributes that should be cast.
     */
    override casts(): Casts<ItemAttributes> {
        return {
            price     : 'float',
            meta      : 'json',
            created_at: 'datetime',
        };
    }
}

interface Item extends ItemAttributes {
}

interface AccountAttributes {
    name: string;
    email: string;
    age: number;
    meta: { tags: string[] };
    created_at: Date;
    banner: string;
}

class Account extends Model<AccountAttributes> {
    /**
     * Get the attributes that should be cast.
     */
    override casts(): Casts<AccountAttributes> {
        return {
            age       : 'int',
            meta      : 'json',
            created_at: 'datetime',
        };
    }

    /**
     * Get the accessor and mutator definitions.
     */
    override mutators(): Attributes<AccountAttributes> {
        return {
            banner: Attribute.get<string>((_value: unknown, attributes: AttributeBag<AccountAttributes>): string => `Hi ${String(attributes['name'])}`),
        };
    }
}

interface Account extends AccountAttributes {
}

interface PersonAttributes {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    settings: { theme: string };
    created_at: Date;
    fullName: string;
}

class Frozen implements Cast<{ theme: string }> {
    /**
     * Freeze the raw settings object on read.
     */
    get(value: unknown): { theme: string } {
        return Object.freeze({ ...(value as { theme: string }) });
    }

    /**
     * Store the settings object as given.
     */
    set(value: { theme: string }): unknown {
        return value;
    }
}

class Person extends Model<PersonAttributes> {
    /**
     * Get the attributes that should be cast.
     */
    override casts(): Casts<PersonAttributes> {
        return {
            id        : 'int',
            settings  : Frozen,
            created_at: 'datetime',
        };
    }

    /**
     * Get the accessor and mutator definitions.
     */
    override mutators(): Attributes<PersonAttributes> {
        return {
            fullName: Attribute.make<string>({
                get: (_value: unknown, attributes: AttributeBag<PersonAttributes>): string => `${String(attributes['first_name'])} ${String(attributes['last_name'])}`,
                set: (value: string): unknown => {
                    const [first, last]: string[] = value.split(' ');

                    return { first_name: first, last_name: last };
                },
            }),
        };
    }

}

interface Person extends PersonAttributes {
}

interface PostAttributes {
    title: string;
    published: boolean;
}

class Post extends Model<PostAttributes> {
    /**
     * Get the attributes that should be cast.
     */
    override casts(): Casts<PostAttributes> {
        return { published: 'bool' };
    }
}

interface Post extends PostAttributes {
}

interface BlogAttributes {
    name: string;
    featured: Post;
    posts: Post[];
}

class Blog extends Model<BlogAttributes> {
    /**
     * Get the related model definitions.
     */
    override relations(): Relations<BlogAttributes> {
        return {
            featured: Post,
            posts   : Post,
        };
    }
}

interface Blog extends BlogAttributes {
}

describe('Model.constructor', (): void => {
    test('applies defaults, then mass-fills the given attributes', (): void => {
        const user: User = new User({ first_name: 'Ana', age: 30 });

        expect(user.raw('age')).toEqual(30);
        expect(user.raw('first_name')).toEqual('Ana');
        expect(new User().raw('age')).toEqual(18);
    });

    test('fills every given attribute', (): void => {
        const open: Open = new Open({ anything: 'goes' });

        expect(open.raw('anything')).toEqual('goes');
    });
});

describe('Model.casts', (): void => {
    class Upper implements Cast<string> {
        /**
         * Uppercase the raw value on read.
         */
        get(value: unknown): string {
            return String(value).toUpperCase();
        }

        /**
         * Lowercase the value for storage.
         */
        set(value: string): unknown {
            return value.toLowerCase();
        }
    }

    enum Status {
        Active   = 'active',
        Inactive = 'inactive',
    }

    enum Level {
        Low  = 0,
        High = 1,
    }

    class Caster extends Model {
        /**
         * Get the attributes that should be cast.
         */
        override casts(): Casts<AttributeBag> {
            return {
                int      : 'int',
                integer  : 'integer',
                float    : 'float',
                double   : 'double',
                number   : 'number',
                string   : 'string',
                bool     : 'bool',
                boolean  : 'boolean',
                json     : 'json',
                array    : 'array',
                object   : 'object',
                date     : 'date',
                datetime : 'datetime',
                timestamp: 'timestamp',
                decimal  : 'decimal:2',
                zero     : 'decimal:0',
                custom   : Upper,
                status   : Status,
                level    : Level,
                broken   : 'nonsense' as never,
                precision: 'decimal:nope' as never,
                negative : 'decimal:-1' as never,
            };
        }
    }

    test('returns the declared cast map', (): void => {
        expect(new User().casts()).toEqual({ id: 'int', age: 'int', meta: 'json', created_at: 'datetime' });
    });

    test('passes null and undefined through untouched on read', (): void => {
        const caster: Caster = Caster.hydrate({ int: null, json: undefined });

        expect(caster.get('int')).toBeNull();
        expect(caster.get('json')).toBeUndefined();
    });

    test('casts integers by truncating numerics', (): void => {
        const caster: Caster = Caster.hydrate({ int: '42.9', integer: 7.9 });

        expect(caster.get('int')).toEqual(42);
        expect(caster.get('integer')).toEqual(7);
    });

    test('casts floats and numbers', (): void => {
        const caster: Caster = Caster.hydrate({ float: '3.14', double: '2.5', number: '1e3' });

        expect(caster.get('float')).toEqual(3.14);
        expect(caster.get('double')).toEqual(2.5);
        expect(caster.get('number')).toEqual(1000);
    });

    test('casts strings', (): void => {
        expect(Caster.hydrate({ string: 42 }).get('string')).toEqual('42');
    });

    test('casts booleans with PHP-like semantics', (): void => {
        const caster: Caster = new Caster();

        expect(caster.set('bool', '0').get('bool')).toEqual(false);
        expect(caster.set('bool', '').get('bool')).toEqual(false);
        expect(caster.set('bool', 'false').get('bool')).toEqual(false);
        expect(caster.set('bool', 0).get('bool')).toEqual(false);
        expect(caster.set('bool', false).get('bool')).toEqual(false);
        expect(caster.set('boolean', 1).get('boolean')).toEqual(true);
        expect(caster.set('boolean', 'yes').get('boolean')).toEqual(true);
    });

    test('parses json strings and passes parsed data through', (): void => {
        const caster: Caster = Caster.hydrate({ json: '{"a":1}', array: [1, 2], object: { b: 2 } });

        expect(caster.get('json')).toEqual({ a: 1 });
        expect(caster.get('array')).toEqual([1, 2]);
        expect(caster.get('object')).toEqual({ b: 2 });
    });

    test('casts dates to local start of day', (): void => {
        const value: Date = Caster.hydrate({ date: '2026-08-23T15:30:00.000Z' }).get('date') as Date;

        expect(value).toBeInstanceOf(Date);
        expect(value.getHours()).toEqual(0);
        expect(value.getMinutes()).toEqual(0);
    });

    test('casts datetimes from strings, unix seconds, numeric strings, and Dates', (): void => {
        const reader = (raw: unknown): Date => Caster.hydrate({ datetime: raw }).get('datetime') as Date;

        expect(reader('2026-08-23T10:00:00.000Z').toISOString()).toEqual('2026-08-23T10:00:00.000Z');
        expect(reader(1756000000).getTime()).toEqual(1756000000000);
        expect(reader('1756000000').getTime()).toEqual(1756000000000);
        expect(reader('1756000000.75').getTime()).toEqual(1756000000750);

        const source: Date = new Date('2026-01-01T00:00:00.000Z');
        const copied: Date = reader(source);

        expect(copied.getTime()).toEqual(source.getTime());
        expect(copied).not.toBe(source);
    });

    test('casts timestamps to unix seconds on read', (): void => {
        expect(Caster.hydrate({ timestamp: '2026-08-23T10:00:00.000Z' }).get('timestamp')).toEqual(1787479200);
        expect(Caster.hydrate({ timestamp: 1756000000 }).get('timestamp')).toEqual(1756000000);
        expect(Caster.hydrate({ timestamp: '1756000000.75' }).get('timestamp')).toEqual(1756000000);
    });

    test('formats decimals with fixed places', (): void => {
        const caster: Caster = Caster.hydrate({ decimal: 3.14159, zero: '7.9' });

        expect(caster.get('decimal')).toEqual('3.14');
        expect(caster.get('zero')).toEqual('8');
    });

    test('throws on invalid decimal precision', (): void => {
        expect((): unknown => Caster.hydrate({ precision: 1 }).get('precision')).toThrow(TypeError);
        expect((): unknown => Caster.hydrate({ negative: 1 }).get('negative')).toThrow(TypeError);
        expect((): unknown => Caster.hydrate({ precision: null }).get('precision')).toThrow(TypeError);
    });

    test('throws on unknown cast strings even for null values', (): void => {
        expect((): unknown => Caster.hydrate({ broken: 1 }).get('broken')).toThrow('Unknown cast type [nonsense] for attribute [broken].');
        expect((): unknown => Caster.hydrate({ broken: null }).get('broken')).toThrow(TypeError);
    });

    test('delegates reads and writes to custom cast classes', (): void => {
        expect(Caster.hydrate({ custom: 'abc' }).get('custom')).toEqual('ABC');
        expect(new Caster().set('custom', 'ABC').raw('custom')).toEqual('abc');
    });

    test('applies custom casts with memoized identity', (): void => {
        const person: Person = new Person({ settings: { theme: 'dark' } });

        expect(person.settings.theme).toEqual('dark');
        expect(Object.isFrozen(person.settings)).toEqual(true);
        expect(person.settings).toBe(person.settings);
    });

    test('validates values against enum casts', (): void => {
        const caster: Caster = new Caster();

        expect(caster.set('status', Status.Active).get('status')).toEqual(Status.Active);
        expect(caster.set('status', null).raw('status')).toBeNull();
        expect(Caster.hydrate({ status: null }).get('status')).toBeNull();
        expect(Caster.hydrate({ status: 'inactive' }).get('status')).toEqual(Status.Inactive);
        expect(Caster.hydrate({ level: 1 }).get('level')).toEqual(Level.High);
        expect((): unknown => Caster.hydrate({ status: 'archived' }).get('status')).toThrow('Invalid enum value [archived] for attribute [status].');
        expect((): unknown => caster.set('status', 'archived')).toThrow(TypeError);
        expect((): unknown => caster.set('level', 'High')).toThrow(TypeError);
    });

    test('passes null and undefined through untouched on write', (): void => {
        const caster: Caster = new Caster();

        expect(caster.set('datetime', null).raw('datetime')).toBeNull();
        expect(caster.set('int', undefined).raw('int')).toBeUndefined();
    });

    test('normalizes Date instances to ISO strings for date and datetime on write', (): void => {
        const caster: Caster = new Caster();

        expect(caster.set('datetime', new Date('2026-08-23T10:00:00.000Z')).raw('datetime')).toEqual('2026-08-23T10:00:00.000Z');
        expect(caster.set('date', new Date('2026-08-23T10:00:00.000Z')).raw('date')).toEqual('2026-08-23T10:00:00.000Z');
        expect(caster.set('datetime', '2026-08-23').raw('datetime')).toEqual('2026-08-23');
    });

    test('normalizes timestamps to unix seconds on write', (): void => {
        const caster: Caster = new Caster();

        expect(caster.set('timestamp', new Date('2026-08-23T10:00:00.000Z')).raw('timestamp')).toEqual(1787479200);
        expect(caster.set('timestamp', '2026-08-23T10:00:00.000Z').raw('timestamp')).toEqual(1787479200);
        expect(caster.set('timestamp', 1756000000.9).raw('timestamp')).toEqual(1756000000);
    });

    test('stores every other built-in cast value as given on write', (): void => {
        const caster: Caster = new Caster();
        const parsed: object = { a: 1 };

        expect(caster.set('int', '42').raw('int')).toEqual('42');
        expect(caster.set('json', parsed).raw('json')).toBe(parsed);
        expect(caster.set('decimal', 3.14159).raw('decimal')).toEqual(3.14159);
    });

    test('throws on unknown cast strings and invalid decimal precision on write', (): void => {
        const caster: Caster = new Caster();

        expect((): unknown => caster.set('broken', 1)).toThrow('Unknown cast type [nonsense] for attribute [broken].');
        expect((): unknown => caster.set('broken', null)).toThrow(TypeError);
        expect((): unknown => caster.set('precision', 5)).toThrow(TypeError);
        expect((): unknown => caster.set('negative', 5)).toThrow(TypeError);
    });
});

describe('Model.get', (): void => {
    test('applies casts on read', (): void => {
        const user: User = new User();

        user.set('age', '35');

        expect(user.get('age')).toEqual(35);
    });

    test('parses json strings once and memoizes the object', (): void => {
        const user: User = new User();

        user.set('meta', '{"tags":["a"]}');

        expect(user.get('meta')).toEqual({ tags: ['a'] });
        expect(user.get('meta')).toBe(user.get('meta'));
    });

    test('runs accessors over casts with the raw value', (): void => {
        const user: User = new User({ first_name: 'Ana', last_name: 'Kovač' });

        expect(user.get('fullName')).toEqual('Ana Kovač');
    });

    test('memoizes cached accessor results until the attribute is written', (): void => {
        let calls: number = 0;

        class Cached extends Model {
            /**
             * Get the accessor and mutator definitions.
             */
            override mutators(): Attributes<AttributeBag> {
                return {
                    greeting: Attribute.get<unknown>((value: unknown): string => {
                        calls++;

                        return `Hi ${value}`;
                    }).cache(),
                };
            }
        }

        const cached: Cached = Cached.hydrate({ greeting: 'John' });

        expect(cached.get('greeting')).toEqual('Hi John');
        expect(cached.get('greeting')).toEqual('Hi John');
        expect(calls).toEqual(1);

        cached.set('greeting', 'Jane');

        expect(cached.get('greeting')).toEqual('Hi Jane');
        expect(calls).toEqual(2);
        expect(cached.original('greeting')).toEqual('Hi John');
        expect(calls).toEqual(3);
    });
});

describe('Model.set', (): void => {
    test('invalidates the memo on set', (): void => {
        const user: User = new User();

        user.set('created_at', new Date('2026-01-01T00:00:00.000Z'));

        const before: Date = user.get('created_at');

        user.set('created_at', new Date('2026-02-02T00:00:00.000Z'));

        expect(user.get('created_at')).not.toBe(before);
        expect(user.get('created_at').toISOString()).toEqual('2026-02-02T00:00:00.000Z');
    });

    test('runs mutators on write, including multi-attribute results', (): void => {
        const user: User = new User();

        user.set('email', 'ANA@EXAMPLE.COM');

        expect(user.raw('email')).toEqual('ana@example.com');

        user.set('fullName', 'Iva Horvat');

        expect(user.raw('first_name')).toEqual('Iva');
        expect(user.raw('last_name')).toEqual('Horvat');
    });

    test('stores plain objects as values via the { key: object } mutator form', (): void => {
        interface BoxAttributes {
            meta: { a: number };
        }

        class Box extends Model<BoxAttributes> {
            /**
             * Get the accessor and mutator definitions.
             */
            override mutators(): Attributes<BoxAttributes> {
                return { meta: Attribute.set<{ a: number }>((value: { a: number }): unknown => ({ meta: value })) };
            }
        }

        const box: Box = new Box();

        box.set('meta', { a: 1 });

        expect(box.raw('meta')).toEqual({ a: 1 });
    });

    test('stores null-prototype mutator results as multiple raw attributes', (): void => {
        class Nulled extends Model {
            /**
             * Get the accessor and mutator definitions.
             */
            override mutators(): Attributes<AttributeBag> {
                return {
                    pair: Attribute.set<unknown>((value: unknown): unknown => {
                        const bag: AttributeBag = Object.create(null) as AttributeBag;

                        bag['left'] = value;
                        bag['right'] = value;

                        return bag;
                    }),
                };
            }
        }

        const nulled: Nulled = new Nulled();

        nulled.set('pair', 'x');

        expect(nulled.raw('left')).toEqual('x');
        expect(nulled.raw('right')).toEqual('x');
    });

    test('writes raw directly when a key has a get-only accessor', (): void => {
        interface TagAttributes {
            label: string;
        }

        class Tag extends Model<TagAttributes> {
            /**
             * Get the accessor and mutator definitions.
             */
            override mutators(): Attributes<TagAttributes> {
                return { label: Attribute.get<string>((value: unknown): string => String(value).toUpperCase()) };
            }
        }

        const tag: Tag = new Tag();

        tag.set('label', 'shiny');

        expect(tag.raw('label')).toEqual('shiny');
        expect(tag.get('label')).toEqual('SHINY');
    });

    test('normalizes datetime writes to ISO strings in raw storage', (): void => {
        const user: User = new User();

        user.set('created_at', new Date('2026-08-23T10:00:00.000Z'));

        expect(user.raw('created_at')).toEqual('2026-08-23T10:00:00.000Z');
        expect(user.get('created_at')).toBeInstanceOf(Date);
    });

    test('passes uncast, undefined-definition keys straight through', (): void => {
        const open: Open = new Open();

        open.set('plain', 42);

        expect(open.get('plain')).toEqual(42);
    });

    test('accepts keys outside the declared attribute interface', (): void => {
        const user: User = new User();

        user.set('address', 'Elm Street');

        expect(user.get('address')).toEqual('Elm Street');
        expect(user.has('address')).toEqual(true);
        expect(user.fill({ city: 'Copenhagen' }).get('city')).toEqual('Copenhagen');
    });
});

describe('Model.fill', (): void => {
    test('mass assigns every given attribute', (): void => {
        const user: User = new User();

        user.fill({ first_name: 'Jane', id: 1 });

        expect(user.raw('first_name')).toEqual('Jane');
        expect(user.raw('id')).toEqual(1);
    });

    test('applies casts while filling', (): void => {
        const user: User = new User();

        // @ts-expect-error
        user.fill({ id: '7' });

        expect(user.get('id')).toEqual(7);
    });
});

describe('Model.raw', (): void => {
    test('returns a copy of all raw attributes', (): void => {
        const user: User = new User({ first_name: 'Ana' });
        const bag: AttributeBag = user.raw();

        expect(bag['first_name']).toEqual('Ana');

        bag['first_name'] = 'mutated';

        expect(user.raw('first_name')).toEqual('Ana');
    });
});

describe('Model.has', (): void => {
    test('reports raw and virtual attribute presence', (): void => {
        const user: User = new User({ first_name: 'Ana' });

        expect(user.has('first_name')).toEqual(true);
        expect(user.has('fullName')).toEqual(true);
        expect(user.has('missing')).toEqual(false);
    });

    test('does not report set-only mutator keys as present', (): void => {
        const user: User = new User();

        expect(user.has('email')).toEqual(false);

        user.set('email', 'A@B.C');

        expect(user.has('email')).toEqual(true);
    });

    test('does not report Object.prototype names as present', (): void => {
        expect(new Open().has('toString')).toEqual(false);
    });
});

describe('Model.forget', (): void => {
    test('forgets attributes and their memoized values', (): void => {
        const user: User = new User();

        user.set('meta', { tags: ['x'] });
        user.forget('meta');

        expect(user.raw('meta')).toBeUndefined();
        expect(user.has('meta')).toEqual(false);
    });
});

describe('Model.sync', (): void => {
    test('syncs without cloning exotic values', (): void => {
        const parent: Open = new Open();

        parent.set('child', new Open({ nested: true }));
        parent.set('tags', ['a', 'b']);
        parent.set('meta', { deep: { level: 1 } });

        expect((): Open => parent.sync()).not.toThrow();
        expect((parent.raw('child') as Open).raw('nested')).toEqual(true);
    });
});

describe('Model.dirty', (): void => {
    test('marks constructor-filled attributes dirty and defaults clean', (): void => {
        interface DefaultedAttributes {
            kind: string;
            name: string;
        }

        class Defaulted extends Model<DefaultedAttributes> {
            /**
             * Get the default attribute values.
             */
            override defaults(): Partial<DefaultedAttributes> {
                return { kind: 'basic' };
            }
        }

        const model: Defaulted = new Defaulted({ name: 'X' });

        expect(model.dirty()).toEqual(true);
        expect(model.dirty('name')).toEqual(true);
        expect(model.dirty('kind')).toEqual(false);
    });

    test('reports clean after sync and dirty after set', (): void => {
        const item: Item = new Item({ name: 'Pen' });

        item.sync();

        expect(item.dirty()).toEqual(false);

        item.set('name', 'Pencil');

        expect(item.dirty('name', 'price')).toEqual(true);
        expect(item.dirty('price')).toEqual(false);
    });

    test('compares object values structurally, not by reference', (): void => {
        const item: Item = new Item({ meta: { tags: ['a'] } });

        item.sync();
        item.set('meta', { tags: ['a'] });

        expect(item.dirty()).toEqual(false);

        item.set('meta', { tags: ['b'] });

        expect(item.dirty('meta')).toEqual(true);
    });

    test('detects in-place mutation of json objects thanks to cloned originals', (): void => {
        const item: Item = new Item({ meta: { tags: ['a'] } });

        item.sync();
        (item.raw('meta') as { tags: string[] }).tags.push('b');

        expect(item.dirty('meta')).toEqual(true);
    });

    test('treats string-number changes as dirty (stricter than Eloquent)', (): void => {
        const item: Item = new Item({ price: 5 });

        item.sync();
        // @ts-expect-error
        item.fill({ price: '5' });

        expect(item.dirty('price')).toEqual(true);
    });

    test('treats distinct exotic references as dirty even when they stringify alike', (): void => {
        class Holder extends Model {
        }

        const holder: Holder = new Holder();

        holder.set('child', new Holder());
        holder.sync();
        holder.set('child', new Holder());

        expect(holder.dirty('child')).toEqual(true);
    });

    test('compares arrays structurally in both directions', (): void => {
        class Holder extends Model {
        }

        const holder: Holder = new Holder();

        holder.set('tags', ['a']);
        holder.sync();
        holder.set('tags', ['a', 'b']);

        expect(holder.dirty('tags')).toEqual(true);

        holder.set('tags', ['a']);

        expect(holder.dirty('tags')).toEqual(false);
    });

    test('does not report Object.prototype names as dirty', (): void => {
        expect(new Open().dirty('toString')).toEqual(false);
    });
});

describe('Model.changes', (): void => {
    test('returns the changed raw attributes since the last sync', (): void => {
        const item: Item = new Item({ name: 'Pen' });

        item.sync();
        item.set('name', 'Pencil');

        expect(item.changes()).toEqual({ name: 'Pencil' });
    });
});

describe('Model.original', (): void => {
    test('returns cast-applied originals', (): void => {
        const item: Item = new Item({ created_at: new Date('2026-01-01T00:00:00.000Z'), name: 'Pen' });

        item.sync();
        item.set('created_at', new Date('2026-06-06T00:00:00.000Z'));

        expect((item.original('created_at') as Date).toISOString()).toEqual('2026-01-01T00:00:00.000Z');

        const bag: AttributeBag = item.original();

        expect(bag['name']).toEqual('Pen');
        expect((bag['created_at'] as Date).toISOString()).toEqual('2026-01-01T00:00:00.000Z');
    });

    test('returns the fallback when the key was never synced', (): void => {
        const item: Item = Item.hydrate({ name: 'Pen' });

        expect(item.original('price', 100)).toEqual(100);
        expect(item.original('price')).toBeUndefined();
    });
});

describe('Model.rawOriginal', (): void => {
    test('returns the raw original attributes without casts', (): void => {
        const item: Item = Item.hydrate({ name: 'Pen', created_at: '2026-01-01T00:00:00.000Z' });

        item.set('created_at', new Date('2026-06-06T00:00:00.000Z'));

        expect(item.rawOriginal('created_at')).toEqual('2026-01-01T00:00:00.000Z');

        const bag: AttributeBag = item.rawOriginal();

        expect(bag['name']).toEqual('Pen');

        bag['name'] = 'mutated';

        expect(item.rawOriginal('name')).toEqual('Pen');
        expect(item.rawOriginal('price', 100)).toEqual(100);
    });
});

describe('Model.replicate', (): void => {
    test('copies the attributes into a fresh dirty instance', (): void => {
        const item: Item = Item.hydrate({ name: 'Pen', price: 5, meta: { tags: ['a'] } });
        const copy: Item = item.replicate();

        expect(copy).toBeInstanceOf(Item);
        expect(copy).not.toBe(item);
        expect(copy.raw()).toEqual(item.raw());
        expect(copy.dirty()).toEqual(true);

        (copy.raw('meta') as { tags: string[] }).tags.push('b');

        expect((item.raw('meta') as { tags: string[] }).tags).toEqual(['a']);
    });

    test('excludes the given keys from the replica', (): void => {
        const item: Item = Item.hydrate({ name: 'Pen', price: 5 });
        const copy: Item = item.replicate('price');

        expect(copy.has('price')).toEqual(false);
        expect(copy.raw('name')).toEqual('Pen');
    });
});

describe('Model.discard', (): void => {
    test('discards changes back to the original state', (): void => {
        const item: Item = new Item({ name: 'Pen', meta: { tags: ['a'] } });

        item.sync();
        item.set('name', 'Pencil');
        item.set('meta', { tags: ['z'] });
        item.discard();

        expect(item.dirty()).toEqual(false);
        expect(item.get('name')).toEqual('Pen');
        expect(item.get('meta')).toEqual({ tags: ['a'] });
    });

    test('discards and re-syncs across the whole pipeline', (): void => {
        const person: Person = Person.hydrate({ first_name: 'Ana', settings: { theme: 'dark' } });

        person.first_name = 'Iva';
        person.settings = { theme: 'light' };
        person.discard();

        expect(person.first_name).toEqual('Ana');
        expect(person.settings.theme).toEqual('dark');

        person.first_name = 'Mia';
        person.sync();

        expect(person.dirty()).toEqual(false);
    });
});

describe('Model.hydrate', (): void => {
    test('creates a clean model from trusted raw data', (): void => {
        interface LockedAttributes {
            id: number;
            secret: string;
        }

        class Locked extends Model<LockedAttributes> {
        }

        const locked: Locked = Locked.hydrate({ id: 5, secret: 'raw' });

        expect(locked.raw('id')).toEqual(5);
        expect(locked.dirty()).toEqual(false);
    });

    test('replaces defaults entirely, mirroring newFromBuilder', (): void => {
        interface StampedAttributes {
            kind: string;
        }

        class Stamped extends Model<StampedAttributes> {
            /**
             * Get the default attribute values.
             */
            override defaults(): Partial<StampedAttributes> {
                return { kind: 'basic' };
            }
        }

        const stamped: Stamped = Stamped.hydrate({});

        expect(stamped.raw('kind')).toBeUndefined();
    });

    test('applies casts on read of hydrated raw strings', (): void => {
        const item: Item = Item.hydrate({ meta: '{"tags":["a"]}', created_at: '2026-01-01T00:00:00.000Z' });

        expect(item.get('meta')).toEqual({ tags: ['a'] });
        expect(item.get('created_at')).toBeInstanceOf(Date);
    });

    test('constructs dirty, hydrates clean', (): void => {
        expect(new Person({ first_name: 'Ana' }).dirty()).toEqual(true);
        expect(Person.hydrate({ first_name: 'Ana' }).dirty()).toEqual(false);
    });
});

describe('Model.toJSON', (): void => {
    test('applies casts and accessors when serializing', (): void => {
        const account: Account = new Account({ name: 'Ana', email: 'a@b.c', age: '30' as unknown as number });

        expect(account.toJSON()).toEqual({ name: 'Ana', email: 'a@b.c', age: 30 });
    });

    test('round-trips through JSON.stringify with ISO dates', (): void => {
        const account: Account = new Account({ name: 'Ana', created_at: new Date('2026-08-23T10:00:00.000Z') });
        const parsed: AttributeBag = JSON.parse(JSON.stringify(account)) as AttributeBag;

        expect(parsed['name']).toEqual('Ana');
        expect(parsed['created_at']).toEqual('2026-08-23T10:00:00.000Z');
    });
});

describe('Model.only', (): void => {
    test('returns a cast-applied subset of the attributes', (): void => {
        const account: Account = new Account({ name: 'Ana', email: 'a@b.c', age: '30' as unknown as number });

        expect(account.only('name', 'age')).toEqual({ name: 'Ana', age: 30 });
    });
});

describe('Model.except', (): void => {
    test('returns all cast-applied attributes except the given keys', (): void => {
        const account: Account = new Account({ name: 'Ana', email: 'a@b.c', age: '30' as unknown as number });

        expect(account.except('email', 'age')).toEqual({ name: 'Ana' });
    });
});

describe('Model.proxy', (): void => {
    test('routes direct property access through the pipeline', (): void => {
        const user: User = new User();

        user.age = '40' as unknown as number;

        expect(user.age).toEqual(40);

        user.email = 'UPPER@CASE.COM';

        expect(user.raw('email')).toEqual('upper@case.com');
    });

    test('runs the full pipeline through direct property access', (): void => {
        const person: Person = Person.hydrate({ id: '7', first_name: 'Ana', last_name: 'Kovač', email: 'a@b.c' });

        expect(person.id).toEqual(7);
        expect(person.fullName).toEqual('Ana Kovač');

        person.fullName = 'Iva Horvat';

        expect(person.first_name).toEqual('Iva');
        expect(person.dirty('last_name')).toEqual(true);
    });

    test('shadows attributes with class members and supports in/delete', (): void => {
        const open: Open = new Open({ fill: 'attribute-value', email: 'a@b.c' });

        expect(typeof open.fill).toEqual('function');
        expect(open.get('fill')).toEqual('attribute-value');
        expect('fill' in open).toEqual(true);
        expect('email' in open).toEqual(true);

        delete (open as unknown as Record<string, unknown>)['email'];

        expect(open.has('email')).toEqual(false);
    });

    test('passes symbol properties straight through', (): void => {
        const open: Open = new Open();
        const marker: symbol = Symbol('marker');

        (open as unknown as Record<symbol, unknown>)[marker] = 'internal';

        expect((open as unknown as Record<symbol, unknown>)[marker]).toEqual('internal');
        expect(marker in open).toEqual(true);

        delete (open as unknown as Record<symbol, unknown>)[marker];

        expect(marker in open).toEqual(false);
        expect(Symbol('absent') in open).toEqual(false);
    });

    test('writes and deletes class members via reflection, not attributes', (): void => {
        const open: Open = new Open();

        (open as unknown as Record<string, unknown>)['sync'] = 'shadowed';

        expect((open as unknown as Record<string, unknown>)['sync']).toEqual('shadowed');
        expect(open.has('sync')).toEqual(false);

        delete (open as unknown as Record<string, unknown>)['sync'];

        expect(typeof (open as unknown as Record<string, unknown>)['sync']).toEqual('function');
    });

    test('enumerates attribute keys for Object.keys and spread', (): void => {
        const user: User = User.hydrate({ first_name: 'John', age: '30' });

        expect(Object.keys(user)).toEqual(['first_name', 'age']);
        expect({ ...user }).toEqual({ first_name: 'John', age: 30 });
    });

    test('hides internals and shadowed keys from enumeration', (): void => {
        const open: Open = new Open({ fill: 'attribute-value' });
        const marker: symbol = Symbol('marker');

        (open as unknown as Record<symbol, unknown>)[marker] = 'internal';

        expect(Object.keys(open)).toEqual([]);
        expect({ ...open }).toEqual({});
        expect(Object.getOwnPropertyDescriptor(open, 'missing')).toBeUndefined();
        expect(Object.getOwnPropertyDescriptor(open, 'sync')).toBeUndefined();
        expect(Object.getOwnPropertyDescriptor(open, marker)?.value).toEqual('internal');
    });
});

describe('Model.relations', (): void => {
    test('hydrates related models from raw data', (): void => {
        const blog: Blog = Blog.hydrate({ name: 'Dev', featured: { title: 'Pinned', published: 1 }, posts: [{ title: 'Hello', published: 0 }] });

        expect(blog.featured).toBeInstanceOf(Post);
        expect(blog.featured.published).toEqual(true);
        expect(blog.posts[0]).toBeInstanceOf(Post);
        expect(blog.posts[0]?.title).toEqual('Hello');
        expect(blog.posts[0]?.published).toEqual(false);
        expect(blog.posts[0]?.dirty()).toEqual(false);
        expect(blog.posts).toBe(blog.posts);
    });

    test('passes model instances and empty values through', (): void => {
        const post: Post = Post.hydrate({ title: 'Hello' });
        const blog: Blog = new Blog();

        blog.posts = [post];

        expect(blog.posts[0]).toBe(post);
        expect(blog.get('featured')).toBeUndefined();
        expect(Blog.hydrate({ featured: null }).get('featured')).toBeNull();
    });

    test('hydrates related models from the original state', (): void => {
        const blog: Blog = Blog.hydrate({ posts: [{ title: 'Hello' }] });

        expect((blog.original('posts') as Post[])[0]).toBeInstanceOf(Post);
    });

    test('serializes related models recursively', (): void => {
        const blog: Blog = Blog.hydrate({ name: 'Dev', posts: [{ title: 'Hello', published: 1 }] });
        const parsed: AttributeBag = JSON.parse(JSON.stringify(blog)) as AttributeBag;

        expect(parsed['posts']).toEqual([{ title: 'Hello', published: true }]);
    });
});

describe('Model.defaults', (): void => {
    test('returns the declared default values', (): void => {
        expect(new User().defaults()).toEqual({ age: 18 });
    });
});
