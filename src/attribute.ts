import type { AttributeBag } from './types';

/** Accessor and mutator definition for a single attribute, mirroring Eloquent's Attribute::make. */
export interface Attribute<T = unknown> {
  /** Transform the raw value when the attribute is read. */
  get?: (value: unknown, attributes: AttributeBag) => T;

  /** Transform the incoming value when written. */
  // A plain-object result writes multiple raw attributes instead of one value.
  set?: (value: T, attributes: AttributeBag) => unknown;
}

/** Map of attribute keys to their accessor/mutator definitions. */
export type Attributes<A> = { [K in keyof A & string]?: Attribute<A[K]> };

/** Define an accessor/mutator pair for one attribute. */
export function attr<T>(definition: Attribute<T>): Attribute<T> {
  return definition;
}
