import { describe, expect, it } from 'vitest';
import { attr, Model, type Attributes, type AttributeBag, type Cast, type Casts } from '../src/index';

interface UserAttributes {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  settings: { theme: string };
  created_at: Date;
  fullName: string;
}

/** Custom cast that wraps settings with a frozen copy on read. */
class Frozen implements Cast<{ theme: string }> {
  /** Freeze the raw settings object on read. */
  get(value: unknown): { theme: string } {
    return Object.freeze({ ...(value as { theme: string }) });
  }

  /** Store the settings object as given. */
  set(value: { theme: string }): unknown {
    return value;
  }
}

/** Test model exercising attributes, casts, mass assignment, and serialization. */
class User extends Model<UserAttributes> {
  /** Get the attributes that should be cast. */
  protected override casts(): Casts<UserAttributes> {
    return { id: 'int', settings: new Frozen(), created_at: 'datetime' };
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
    };
  }

  /** Get the attribute keys that are mass assignable. */
  protected override fillable(): (keyof UserAttributes & string)[] {
    return ['first_name', 'last_name', 'email', 'settings', 'created_at'];
  }

  /** Get the attribute keys hidden from serialization. */
  protected override hidden(): (keyof UserAttributes & string)[] {
    return ['email'];
  }

  /** Get the virtual keys appended to serialization. */
  protected override appends(): (keyof UserAttributes & string)[] {
    return ['fullName'];
  }
}
interface User extends UserAttributes {}

describe('end to end', () => {
  it('constructs dirty, hydrates clean', () => {
    expect(new User({ first_name: 'Ana' }).dirty()).toBe(true);
    expect(User.hydrate({ first_name: 'Ana' }).dirty()).toBe(false);
  });

  it('runs the full pipeline through direct property access', () => {
    const user: User = User.hydrate({ id: '7', first_name: 'Ana', last_name: 'Kovač', email: 'a@b.c' });
    expect(user.id).toBe(7);
    expect(user.fullName).toBe('Ana Kovač');
    user.fullName = 'Iva Horvat';
    expect(user.first_name).toBe('Iva');
    expect(user.dirty('last_name')).toBe(true);
  });

  it('applies custom casts with memoized identity', () => {
    const user: User = new User({ settings: { theme: 'dark' } });
    expect(user.settings.theme).toBe('dark');
    expect(Object.isFrozen(user.settings)).toBe(true);
    expect(user.settings).toBe(user.settings);
  });

  it('serializes with hidden and appended keys and ISO dates', () => {
    const user: User = User.hydrate({ first_name: 'Ana', last_name: 'K', email: 'a@b.c', created_at: '2026-08-23T10:00:00.000Z' });
    const parsed: AttributeBag = JSON.parse(JSON.stringify(user)) as AttributeBag;
    expect(parsed['fullName']).toBe('Ana K');
    expect(parsed['created_at']).toBe('2026-08-23T10:00:00.000Z');
    expect('email' in parsed).toBe(false);
  });

  it('discards and re-syncs across the whole pipeline', () => {
    const user: User = User.hydrate({ first_name: 'Ana', settings: { theme: 'dark' } });
    user.first_name = 'Iva';
    user.settings = { theme: 'light' };
    user.discard();
    expect(user.first_name).toBe('Ana');
    expect(user.settings.theme).toBe('dark');
    user.first_name = 'Mia';
    user.sync();
    expect(user.dirty()).toBe(false);
  });
});
