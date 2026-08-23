import { describe, expect, it } from 'vitest';
import { attr, type Attributes } from '../src/attribute';
import { MassAssignmentError, Model } from '../src/model';
import type { AttributeBag, Casts } from '../src/types';

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
  /** Get the attributes that should be cast. */
  protected override casts(): Casts<UserAttributes> {
    return { id: 'int', age: 'int', meta: 'json', created_at: 'datetime' };
  }

  /** Get the accessor and mutator definitions. */
  protected override attributes(): Attributes<UserAttributes> {
    return {
      fullName: attr<string>({
        get: (_value: unknown, attributes: AttributeBag): string =>
          `${String(attributes['first_name'])} ${String(attributes['last_name'])}`,
        set: (value: string): unknown => {
          const [first, last]: string[] = value.split(' ');
          return { first_name: first, last_name: last };
        },
      }),
      email: attr<string>({ set: (value: string): unknown => value.toLowerCase() }),
    };
  }

  /** Get the attribute keys that are mass assignable. */
  protected override fillable(): (keyof UserAttributes & string)[] {
    return ['first_name', 'last_name', 'email', 'age', 'meta', 'created_at'];
  }

  /** Get the default attribute values. */
  protected override defaults(): Partial<UserAttributes> {
    return { age: 18 };
  }
}
interface User extends UserAttributes {}

class Open extends Model {}

describe('construction', () => {
  it('applies defaults, then mass-fills the given attributes', () => {
    const user: User = new User({ first_name: 'Ana', age: 30 });
    expect(user.raw('age')).toBe(30);
    expect(user.raw('first_name')).toBe('Ana');
    expect(new User().raw('age')).toBe(18);
  });

  it('silently discards non-fillable keys by default', () => {
    const user: User = new User({ id: 99 } as Partial<UserAttributes>);
    expect(user.raw('id')).toBeUndefined();
  });

  it('fills everything when no fillable or guarded lists are declared', () => {
    const open: Open = new Open({ anything: 'goes' });
    expect(open.raw('anything')).toBe('goes');
  });
});

describe('get and set', () => {
  it('applies casts on read', () => {
    const user: User = new User();
    user.set('age', '35' as unknown as number);
    expect(user.get('age')).toBe(35);
  });

  it('parses json strings once and memoizes the object', () => {
    const user: User = new User();
    user.set('meta', '{"tags":["a"]}' as unknown as UserAttributes['meta']);
    expect(user.get('meta')).toEqual({ tags: ['a'] });
    expect(user.get('meta')).toBe(user.get('meta')); // identity holds across reads
  });

  it('invalidates the memo on set', () => {
    const user: User = new User();
    user.set('created_at', new Date('2026-01-01T00:00:00.000Z'));
    const before: Date = user.get('created_at');
    user.set('created_at', new Date('2026-02-02T00:00:00.000Z'));
    expect(user.get('created_at')).not.toBe(before);
    expect(user.get('created_at').toISOString()).toBe('2026-02-02T00:00:00.000Z');
  });

  it('runs accessors over casts with the raw value', () => {
    const user: User = new User({ first_name: 'Ana', last_name: 'Kovač' });
    expect(user.get('fullName')).toBe('Ana Kovač');
  });

  it('runs mutators on write, including multi-attribute results', () => {
    const user: User = new User();
    user.set('email', 'ANA@EXAMPLE.COM');
    expect(user.raw('email')).toBe('ana@example.com');
    user.set('fullName', 'Iva Horvat');
    expect(user.raw('first_name')).toBe('Iva');
    expect(user.raw('last_name')).toBe('Horvat');
  });

  it('stores plain objects as values via the { key: object } mutator form', () => {
    interface BoxAttributes { meta: { a: number }; }
    class Box extends Model<BoxAttributes> {
      /** Get the accessor and mutator definitions. */
      protected override attributes(): Attributes<BoxAttributes> {
        return { meta: attr<{ a: number }>({ set: (value: { a: number }): unknown => ({ meta: value }) }) };
      }
    }
    const box: Box = new Box();
    box.set('meta', { a: 1 });
    expect(box.raw('meta')).toEqual({ a: 1 });
  });

  // Not in the brief; added to cover the plain() null-prototype branch (coverage gate is 100%).
  it('treats a null-prototype mutator result as a multi-attribute write', () => {
    interface PairAttributes { a: number; b: number; }
    class Pair extends Model<PairAttributes> {
      /** Get the accessor and mutator definitions. */
      protected override attributes(): Attributes<PairAttributes> {
        return {
          a: attr<number>({
            set: (value: number): unknown => {
              const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
              result['a'] = value;
              result['b'] = value * 2;
              return result;
            },
          }),
        };
      }
    }
    const pair: Pair = new Pair();
    pair.set('a', 5);
    expect(pair.raw('a')).toBe(5);
    expect(pair.raw('b')).toBe(10);
  });

  it('writes raw directly when a key has a get-only accessor', () => {
    interface TagAttributes { label: string; }
    class Tag extends Model<TagAttributes> {
      /** Get the accessor and mutator definitions. */
      protected override attributes(): Attributes<TagAttributes> {
        return { label: attr<string>({ get: (value: unknown): string => String(value).toUpperCase() }) };
      }
    }
    const tag: Tag = new Tag();
    tag.set('label', 'shiny');
    expect(tag.raw('label')).toBe('shiny');
    expect(tag.get('label')).toBe('SHINY');
  });

  it('normalizes datetime writes to ISO strings in raw storage', () => {
    const user: User = new User();
    user.set('created_at', new Date('2026-08-23T10:00:00.000Z'));
    expect(user.raw('created_at')).toBe('2026-08-23T10:00:00.000Z');
    expect(user.get('created_at')).toBeInstanceOf(Date);
  });

  it('passes uncast, undefined-definition keys straight through', () => {
    const open: Open = new Open();
    open.set('plain', 42);
    expect(open.get('plain')).toBe(42);
  });
});

describe('proxy access', () => {
  it('routes direct property access through the pipeline', () => {
    const user: User = new User();
    user.age = '40' as unknown as number;
    expect(user.age).toBe(40);
    user.email = 'UPPER@CASE.COM';
    expect(user.raw('email')).toBe('upper@case.com');
  });

  it('shadows attributes with class members and supports in/delete', () => {
    const open: Open = new Open({ fill: 'attribute-value', email: 'a@b.c' });
    expect(typeof open.fill).toBe('function'); // the method shadows the attribute
    expect(open.get('fill')).toBe('attribute-value');
    expect('email' in open).toBe(true);
    delete (open as unknown as Record<string, unknown>)['email'];
    expect(open.has('email')).toBe(false);
  });
});

describe('mass assignment', () => {
  it('lets fillable win when both lists are declared', () => {
    interface BothAttributes { a: number; b: number; }
    class Both extends Model<BothAttributes> {
      /** Get the attribute keys that are mass assignable. */
      protected override fillable(): (keyof BothAttributes & string)[] {
        return ['a'];
      }

      /** Get the attribute keys that are guarded from mass assignment. */
      protected override guarded(): (keyof BothAttributes & string)[] {
        return ['a', 'b'];
      }
    }
    const both: Both = new Both({ a: 1, b: 2 });
    expect(both.raw('a')).toBe(1);
    expect(both.raw('b')).toBeUndefined();
  });

  it('discards guarded keys when only guarded is declared', () => {
    interface SafeAttributes { open: string; locked: string; }
    class Safe extends Model<SafeAttributes> {
      /** Get the attribute keys that are guarded from mass assignment. */
      protected override guarded(): (keyof SafeAttributes & string)[] {
        return ['locked'];
      }
    }
    const safe: Safe = new Safe({ open: 'yes', locked: 'no' });
    expect(safe.raw('open')).toBe('yes');
    expect(safe.raw('locked')).toBeUndefined();
  });

  it('throws in strict mode instead of discarding', () => {
    Model.strict = true;
    try {
      expect(() => new User({ id: 1 } as Partial<UserAttributes>)).toThrow(MassAssignmentError);
    } finally {
      Model.strict = false;
    }
  });

  it('bypasses guarding with forceFill', () => {
    const user: User = new User();
    user.forceFill({ id: '7' } as unknown as Partial<UserAttributes>);
    expect(user.get('id')).toBe(7); // cast still applies
  });
});

describe('raw, has, forget', () => {
  it('returns a copy of all raw attributes', () => {
    const user: User = new User({ first_name: 'Ana' });
    const bag: AttributeBag = user.raw();
    expect(bag['first_name']).toBe('Ana');
    bag['first_name'] = 'mutated';
    expect(user.raw('first_name')).toBe('Ana');
  });

  it('reports raw and virtual attribute presence', () => {
    const user: User = new User({ first_name: 'Ana' });
    expect(user.has('first_name')).toBe(true);
    expect(user.has('fullName')).toBe(true); // virtual, via accessor definition
    expect(user.has('missing')).toBe(false);
  });

  it('forgets attributes and their memoized values', () => {
    const user: User = new User();
    user.set('meta', { tags: ['x'] });
    user.forget('meta');
    expect(user.raw('meta')).toBeUndefined();
    expect(user.has('meta')).toBe(false);
  });
});

describe('has readability and sync safety', () => {
  it('does not report set-only mutator keys as present', () => {
    const user: User = new User();
    expect(user.has('email')).toBe(false); // set-only mutator, no raw value
    user.set('email', 'A@B.C');
    expect(user.has('email')).toBe(true);
  });

  it('syncs without cloning exotic values', () => {
    const parent: Open = new Open();
    parent.set('child', new Open({ nested: true }));
    parent.set('tags', ['a', 'b']);
    parent.set('meta', { deep: { level: 1 } });
    expect(() => parent.sync()).not.toThrow();
    expect((parent.raw('child') as Open).raw('nested')).toBe(true);
  });
});
