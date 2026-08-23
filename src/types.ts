import type { Cast } from './casts';

/** A bag of raw attribute values keyed by attribute name. */
export type AttributeBag = Record<string, unknown>;

/** Built-in cast type strings supported by the casts() map. */
export type CastType =
  | 'int'
  | 'integer'
  | 'float'
  | 'double'
  | 'number'
  | 'string'
  | 'bool'
  | 'boolean'
  | 'json'
  | 'array'
  | 'object'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | `decimal:${number}`;

/** Map of attribute keys to their cast definitions. */
export type Casts<A> = { [K in keyof A & string]?: CastType | Cast };
