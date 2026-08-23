import { describe, expect, it } from 'vitest';
import { castGet, castSet, type Cast } from '../src/casts';
import type { AttributeBag } from '../src/types';

const bag: AttributeBag = {};

describe('castGet', () => {
  it('passes null and undefined through untouched', () => {
    expect(castGet('int', null, 'key', bag)).toBeNull();
    expect(castGet('json', undefined, 'key', bag)).toBeUndefined();
  });

  it('casts integers by truncating numerics', () => {
    expect(castGet('int', '42.9', 'key', bag)).toBe(42);
    expect(castGet('integer', 7.9, 'key', bag)).toBe(7);
  });

  it('casts floats and numbers', () => {
    expect(castGet('float', '3.14', 'key', bag)).toBe(3.14);
    expect(castGet('double', '2.5', 'key', bag)).toBe(2.5);
    expect(castGet('number', '1e3', 'key', bag)).toBe(1000);
  });

  it('casts strings', () => {
    expect(castGet('string', 42, 'key', bag)).toBe('42');
  });

  it('casts booleans with PHP-like semantics', () => {
    expect(castGet('bool', '0', 'key', bag)).toBe(false);
    expect(castGet('bool', '', 'key', bag)).toBe(false);
    expect(castGet('bool', 'false', 'key', bag)).toBe(false);
    expect(castGet('bool', 0, 'key', bag)).toBe(false);
    expect(castGet('bool', false, 'key', bag)).toBe(false);
    expect(castGet('boolean', 1, 'key', bag)).toBe(true);
    expect(castGet('boolean', 'yes', 'key', bag)).toBe(true);
  });

  it('parses json strings and passes parsed data through', () => {
    expect(castGet('json', '{"a":1}', 'key', bag)).toEqual({ a: 1 });
    expect(castGet('array', [1, 2], 'key', bag)).toEqual([1, 2]);
    expect(castGet('object', { b: 2 }, 'key', bag)).toEqual({ b: 2 });
  });

  it('casts dates to local start of day', () => {
    const value: Date = castGet('date', '2026-08-23T15:30:00.000Z', 'key', bag) as Date;
    expect(value).toBeInstanceOf(Date);
    expect(value.getHours()).toBe(0);
    expect(value.getMinutes()).toBe(0);
  });

  it('casts datetimes from strings, unix seconds, numeric strings, and Dates', () => {
    expect((castGet('datetime', '2026-08-23T10:00:00.000Z', 'key', bag) as Date).toISOString()).toBe('2026-08-23T10:00:00.000Z');
    expect((castGet('datetime', 1756000000, 'key', bag) as Date).getTime()).toBe(1756000000000);
    expect((castGet('datetime', '1756000000', 'key', bag) as Date).getTime()).toBe(1756000000000);
    const source: Date = new Date('2026-01-01T00:00:00.000Z');
    const copied: Date = castGet('datetime', source, 'key', bag) as Date;
    expect(copied.getTime()).toBe(source.getTime());
    expect(copied).not.toBe(source); // defensive copy
  });

  it('casts datetimes from fractional unix-second numeric strings', () => {
    expect((castGet('datetime', '1756000000.75', 'key', bag) as Date).getTime()).toBe(1756000000750);
  });

  it('casts timestamps to unix seconds', () => {
    expect(castGet('timestamp', '2026-08-23T10:00:00.000Z', 'key', bag)).toBe(1787479200);
    expect(castGet('timestamp', 1756000000, 'key', bag)).toBe(1756000000);
    expect(castGet('timestamp', '1756000000.75', 'key', bag)).toBe(1756000000);
  });

  it('formats decimals with fixed places', () => {
    expect(castGet('decimal:2', 3.14159, 'key', bag)).toBe('3.14');
    expect(castGet('decimal:0', '7.9', 'key', bag)).toBe('8');
  });

  it('throws on invalid decimal precision', () => {
    expect(() => castGet('decimal:nope' as never, 1, 'key', bag)).toThrow(TypeError);
    expect(() => castGet('decimal:-1' as never, 1, 'key', bag)).toThrow(TypeError);
    expect(() => castGet('decimal:nope' as never, null, 'key', bag)).toThrow(TypeError);
  });

  it('throws on unknown cast strings', () => {
    expect(() => castGet('nonsense' as never, 1, 'key', bag)).toThrow('Unknown cast type [nonsense] for attribute [key].');
    expect(() => castGet('nonsense' as never, null, 'key', bag)).toThrow(TypeError);
  });

  it('delegates to custom cast instances', () => {
    const upper: Cast<string> = {
      get: (value: unknown): string => String(value).toUpperCase(),
      set: (value: string): unknown => value.toLowerCase(),
    };
    expect(castGet(upper, 'abc', 'key', bag)).toBe('ABC');
  });
});

describe('castSet', () => {
  it('passes null and undefined through untouched', () => {
    expect(castSet('datetime', null, 'key', bag)).toBeNull();
    expect(castSet('int', undefined, 'key', bag)).toBeUndefined();
  });

  it('normalizes Date instances to ISO strings for date and datetime', () => {
    expect(castSet('datetime', new Date('2026-08-23T10:00:00.000Z'), 'key', bag)).toBe('2026-08-23T10:00:00.000Z');
    expect(castSet('date', new Date('2026-08-23T10:00:00.000Z'), 'key', bag)).toBe('2026-08-23T10:00:00.000Z');
    expect(castSet('datetime', '2026-08-23', 'key', bag)).toBe('2026-08-23');
  });

  it('normalizes timestamps to unix seconds', () => {
    expect(castSet('timestamp', new Date('2026-08-23T10:00:00.000Z'), 'key', bag)).toBe(1787479200);
    expect(castSet('timestamp', '2026-08-23T10:00:00.000Z', 'key', bag)).toBe(1787479200);
    expect(castSet('timestamp', 1756000000.9, 'key', bag)).toBe(1756000000);
  });

  it('stores every other built-in cast value as given', () => {
    expect(castSet('int', '42', 'key', bag)).toBe('42');
    const parsed: object = { a: 1 };
    expect(castSet('json', parsed, 'key', bag)).toBe(parsed); // no stringify — raw stays JSON-shaped
    expect(castSet('decimal:2', 3.14159, 'key', bag)).toBe(3.14159);
  });

  it('throws on invalid decimal precision', () => {
    expect(() => castSet('decimal:nope' as never, 5, 'key', bag)).toThrow(TypeError);
    expect(() => castSet('decimal:-1' as never, 5, 'key', bag)).toThrow(TypeError);
  });

  it('throws on unknown cast strings', () => {
    expect(() => castSet('nonsense' as never, 1, 'key', bag)).toThrow('Unknown cast type [nonsense] for attribute [key].');
    expect(() => castSet('nonsense' as never, null, 'key', bag)).toThrow(TypeError);
  });

  it('delegates to custom cast instances', () => {
    const upper: Cast<string> = {
      get: (value: unknown): string => String(value).toUpperCase(),
      set: (value: string): unknown => value.toLowerCase(),
    };
    expect(castSet(upper, 'ABC', 'key', bag)).toBe('abc');
  });
});
