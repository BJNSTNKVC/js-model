import { describe, expect, it } from 'vitest';
import { Model } from '../src/model';
import type { AttributeBag, Casts } from '../src/types';

interface ItemAttributes {
  name: string;
  price: number;
  meta: { tags: string[] };
  created_at: Date;
}

class Item extends Model<ItemAttributes> {
  /** Get the attributes that should be cast. */
  protected override casts(): Casts<ItemAttributes> {
    return { price: 'float', meta: 'json', created_at: 'datetime' };
  }
}
interface Item extends ItemAttributes {}

describe('dirty tracking', () => {
  it('marks constructor-filled attributes dirty and defaults clean', () => {
    interface DefaultedAttributes { kind: string; name: string; }
    class Defaulted extends Model<DefaultedAttributes> {
      /** Get the default attribute values. */
      protected override defaults(): Partial<DefaultedAttributes> {
        return { kind: 'basic' };
      }
    }
    const model: Defaulted = new Defaulted({ name: 'X' });
    expect(model.dirty()).toBe(true);
    expect(model.dirty('name')).toBe(true);
    expect(model.dirty('kind')).toBe(false);
    expect(model.changes()).toEqual({ name: 'X' });
  });

  it('reports clean after sync and dirty after set', () => {
    const item: Item = new Item({ name: 'Pen' });
    item.sync();
    expect(item.dirty()).toBe(false);
    item.set('name', 'Pencil');
    expect(item.dirty('name', 'price')).toBe(true);
    expect(item.dirty('price')).toBe(false);
  });

  it('compares object values structurally, not by reference', () => {
    const item: Item = new Item({ meta: { tags: ['a'] } });
    item.sync();
    item.set('meta', { tags: ['a'] });
    expect(item.dirty()).toBe(false); // equal content → clean
    item.set('meta', { tags: ['b'] });
    expect(item.dirty('meta')).toBe(true);
  });

  it('detects in-place mutation of json objects thanks to cloned originals', () => {
    const item: Item = new Item({ meta: { tags: ['a'] } });
    item.sync()
    ;(item.raw('meta') as { tags: string[] }).tags.push('b'); // mutate the live raw object
    expect(item.dirty('meta')).toBe(true);
  });

  it('treats string-number changes as dirty (stricter than Eloquent)', () => {
    const item: Item = new Item({ price: 5 });
    item.sync();
    item.forceFill({ price: '5' } as unknown as Partial<ItemAttributes>);
    expect(item.dirty('price')).toBe(true);
  });

  it('returns cast-applied originals', () => {
    const item: Item = new Item({ created_at: new Date('2026-01-01T00:00:00.000Z'), name: 'Pen' });
    item.sync();
    item.set('created_at', new Date('2026-06-06T00:00:00.000Z'));
    expect((item.original('created_at') as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    const bag: AttributeBag = item.original();
    expect(bag['name']).toBe('Pen');
    expect((bag['created_at'] as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('treats distinct exotic references as dirty even when they stringify alike', () => {
    class Holder extends Model {}
    const holder: Holder = new Holder();
    holder.set('child', new Holder());
    holder.sync();
    holder.set('child', new Holder());
    expect(holder.dirty('child')).toBe(true); // '{}' === '{}' must not prove equivalence
  });

  it('compares arrays structurally in both directions', () => {
    class Holder extends Model {}
    const holder: Holder = new Holder();
    holder.set('tags', ['a']);
    holder.sync();
    holder.set('tags', ['a', 'b']);
    expect(holder.dirty('tags')).toBe(true);
    holder.set('tags', ['a']);
    expect(holder.dirty('tags')).toBe(false); // snapshot copied the original, content matches
  });

  it('discards changes back to the original state', () => {
    const item: Item = new Item({ name: 'Pen', meta: { tags: ['a'] } });
    item.sync();
    item.set('name', 'Pencil');
    item.set('meta', { tags: ['z'] });
    item.discard();
    expect(item.dirty()).toBe(false);
    expect(item.get('name')).toBe('Pen');
    expect(item.get('meta')).toEqual({ tags: ['a'] });
  });
});

describe('hydrate', () => {
  it('creates a clean model from trusted raw data, bypassing guards and mutators', () => {
    interface LockedAttributes { id: number; secret: string; }
    class Locked extends Model<LockedAttributes> {
      /** Get the attribute keys that are mass assignable. */
      protected override fillable(): (keyof LockedAttributes & string)[] {
        return ['secret'];
      }
    }
    const locked: Locked = Locked.hydrate({ id: 5, secret: 'raw' });
    expect(locked.raw('id')).toBe(5); // guard bypassed
    expect(locked.dirty()).toBe(false); // synced clean
  });

  it('replaces defaults entirely, mirroring newFromBuilder', () => {
    interface StampedAttributes { kind: string; }
    class Stamped extends Model<StampedAttributes> {
      /** Get the default attribute values. */
      protected override defaults(): Partial<StampedAttributes> {
        return { kind: 'basic' };
      }
    }
    const stamped: Stamped = Stamped.hydrate({});
    expect(stamped.raw('kind')).toBeUndefined();
  });

  it('applies casts on read of hydrated raw strings', () => {
    const item: Item = Item.hydrate({ meta: '{"tags":["a"]}', created_at: '2026-01-01T00:00:00.000Z' });
    expect(item.get('meta')).toEqual({ tags: ['a'] });
    expect(item.get('created_at')).toBeInstanceOf(Date);
  });
});
