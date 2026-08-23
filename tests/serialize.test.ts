import { describe, expect, it } from 'vitest';
import { attr, type Attributes } from '../src/attribute';
import { Model } from '../src/model';
import type { AttributeBag, Casts } from '../src/types';

interface AccountAttributes {
  name: string;
  email: string;
  age: number;
  meta: { tags: string[] };
  created_at: Date;
  banner: string;
}

class Account extends Model<AccountAttributes> {
  /** Get the attributes that should be cast. */
  protected override casts(): Casts<AccountAttributes> {
    return { age: 'int', meta: 'json', created_at: 'datetime' };
  }

  /** Get the accessor and mutator definitions. */
  protected override attributes(): Attributes<AccountAttributes> {
    return {
      banner: attr<string>({
        get: (_value: unknown, attributes: AttributeBag): string => `Hi ${String(attributes['name'])}`,
      }),
    };
  }

  /** Get the attribute keys hidden from serialization. */
  protected override hidden(): (keyof AccountAttributes & string)[] {
    return ['email'];
  }

  /** Get the virtual keys appended to serialization. */
  protected override appends(): (keyof AccountAttributes & string)[] {
    return ['banner'];
  }
}
interface Account extends AccountAttributes {}

describe('toJSON', () => {
  it('applies casts and accessors, appends virtuals, and hides hidden keys', () => {
    const account: Account = new Account({ name: 'Ana', email: 'a@b.c', age: '30' as unknown as number });
    const output: AttributeBag = account.toJSON();
    expect(output).toEqual({ name: 'Ana', age: 30, banner: 'Hi Ana' });
    expect('email' in output).toBe(false);
  });

  it('round-trips through JSON.stringify with ISO dates', () => {
    const account: Account = new Account({ name: 'Ana', created_at: new Date('2026-08-23T10:00:00.000Z') });
    const parsed: AttributeBag = JSON.parse(JSON.stringify(account)) as AttributeBag;
    expect(parsed['created_at']).toBe('2026-08-23T10:00:00.000Z');
    expect(parsed['banner']).toBe('Hi Ana');
  });

  it('lets a non-empty visible whitelist win first', () => {
    interface NarrowAttributes { a: number; b: number; }
    class Narrow extends Model<NarrowAttributes> {
      /** Get the serialization whitelist. */
      protected override visible(): (keyof NarrowAttributes & string)[] {
        return ['a'];
      }
    }
    const narrow: Narrow = new Narrow({ a: 1, b: 2 });
    expect(narrow.toJSON()).toEqual({ a: 1 });
  });

  it('supports runtime hide, show, and append', () => {
    const account: Account = new Account({ name: 'Ana', email: 'a@b.c' });
    account.show('email').hide('name');
    expect(account.toJSON()).toEqual({ email: 'a@b.c', banner: 'Hi Ana' });
    interface BareAttributes { x: number; upper: string; }
    class Bare extends Model<BareAttributes> {
      /** Get the accessor and mutator definitions. */
      protected override attributes(): Attributes<BareAttributes> {
        return { upper: attr<string>({ get: (_value: unknown, attributes: AttributeBag): string => String(attributes['x']).toUpperCase() }) };
      }
    }
    const bare: Bare = new Bare({ x: 1 });
    expect(bare.toJSON()).toEqual({ x: 1 });
    bare.append('upper');
    expect(bare.toJSON()).toEqual({ x: 1, upper: '1' });
  });

  it('adds shown keys to a non-empty whitelist', () => {
    interface ListedAttributes { a: number; b: number; }
    class Listed extends Model<ListedAttributes> {
      /** Get the serialization whitelist. */
      protected override visible(): (keyof ListedAttributes & string)[] {
        return ['a'];
      }
    }
    const listed: Listed = new Listed({ a: 1, b: 2 });
    listed.show('b');
    expect(listed.toJSON()).toEqual({ a: 1, b: 2 });
  });
});

describe('only and except', () => {
  it('returns cast-applied subsets', () => {
    const account: Account = new Account({ name: 'Ana', email: 'a@b.c', age: '30' as unknown as number });
    expect(account.only('name', 'age')).toEqual({ name: 'Ana', age: 30 });
    expect(account.except('email', 'age')).toEqual({ name: 'Ana' });
  });
});
