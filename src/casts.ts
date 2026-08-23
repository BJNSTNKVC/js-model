import type { AttributeBag, CastType } from './types';

/** Contract for custom cast classes, mirroring Eloquent's CastsAttributes. */
export interface Cast<T = unknown> {
  /** Transform the raw attribute value when read. */
  get(value: unknown, key: string, attributes: AttributeBag): T;

  /** Transform the value into its raw storage form when written. */
  set(value: T, key: string, attributes: AttributeBag): unknown;
}

// Built-in cast strings recognized by the resolver, besides parameterized decimals.
const KNOWN: readonly string[] = [
  'int', 'integer', 'float', 'double', 'number', 'string', 'bool', 'boolean',
  'json', 'array', 'object', 'date', 'datetime', 'timestamp',
];

/** Cast a raw value for reading. */
export function castGet(cast: CastType | Cast, value: unknown, key: string, attributes: AttributeBag): unknown {
  if (typeof cast === 'object') {
    return cast.get(value, key, attributes);
  }

  // Null and undefined pass through every VALID built-in cast untouched.
  if (value === null || value === undefined) {
    validate(cast, key);
    return value;
  }

  if (cast.startsWith('decimal:')) {
    return decimal(cast, value, key);
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
      return truthy(value);
    case 'json':
    case 'array':
    case 'object':
      // Raw values arriving as strings (e.g. hydrated JSON columns) are parsed; parsed data passes through.
      return typeof value === 'string' ? JSON.parse(value) : value;
    case 'date':
      return day(value);
    case 'datetime':
      return moment(value);
    case 'timestamp':
      return seconds(value);
    default:
      throw new TypeError(`Unknown cast type [${cast as string}] for attribute [${key}].`);
  }
}

/** Normalize a value into its raw storage form for writing. */
export function castSet(cast: CastType | Cast, value: unknown, key: string, attributes: AttributeBag): unknown {
  if (typeof cast === 'object') {
    return cast.set(value, key, attributes);
  }

  validate(cast, key);

  if (value === null || value === undefined) {
    return value;
  }

  switch (cast) {
    case 'date':
    case 'datetime':
      // Date instances are stored as ISO-8601 strings so raw attributes stay JSON-safe.
      return value instanceof Date ? value.toISOString() : value;
    case 'timestamp':
      return seconds(value);
    default:
      // Every other built-in cast stores the incoming value as given.
      return value;
  }
}

/** Throw when a cast string is not a recognized built-in. */
function validate(cast: string, key: string): void {
  if (cast.startsWith('decimal:')) {
    places(cast, key);
    return;
  }
  if (!KNOWN.includes(cast)) {
    throw new TypeError(`Unknown cast type [${cast}] for attribute [${key}].`);
  }
}

/** Parse and validate the precision of a decimal cast string. */
function places(cast: string, key: string): number {
  const precision: number = Number(cast.slice('decimal:'.length));
  if (!Number.isInteger(precision) || precision < 0) {
    throw new TypeError(`Invalid decimal precision in cast [${cast}] for attribute [${key}].`);
  }
  return precision;
}

/** Format a numeric value as a fixed-decimal string, e.g. decimal:2 → "3.14". */
function decimal(cast: string, value: unknown, key: string): string {
  return Number(value).toFixed(places(cast, key));
}

/** Coerce a raw value to boolean using PHP-like semantics. */
function truthy(value: unknown): boolean {
  // JS Boolean('0') is true, but data arriving as '0' or 'false' always means false.
  return value === false || value === 0 || value === '0' || value === '' || value === 'false'
    ? false
    : Boolean(value);
}

/** Parse a raw value into a Date at local start of day. */
function day(value: unknown): Date {
  const parsed: Date = moment(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Parse a raw value into a Date. */
function moment(value: unknown): Date {
  if (value instanceof Date) {
    // Copy so memoized reads never share a mutable instance with the caller.
    return new Date(value.getTime());
  }
  // Whole-number values and numeric strings are unix seconds, not milliseconds.
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
    return new Date(Number(value) * 1000);
  }
  return new Date(value as string);
}

/** Convert a raw value into unix seconds. */
function seconds(value: unknown): number {
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
    return Math.trunc(Number(value));
  }
  return Math.floor(new Date(value as string).getTime() / 1000);
}
