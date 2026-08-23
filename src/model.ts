import type { Attribute, Attributes } from './attribute';
import { castGet, castSet, type Cast } from './casts';
import { handler } from './proxy';
import type { AttributeBag, Casts, CastType } from './types';

/** Error thrown in strict mode when mass assignment discards a non-fillable key. */
export class MassAssignmentError extends Error {
  /** Identify the error class in stack traces and name checks. */
  override name: string = 'MassAssignmentError';
}

// Internal state lives under symbols so it passes cleanly through the proxy traps;
// #private fields would break because the proxy, not the target, is `this` inside methods.
const ATTRIBUTES: unique symbol = Symbol('attributes');
const ORIGINAL: unique symbol = Symbol('original');
const MEMO: unique symbol = Symbol('memo');
const HIDDEN: unique symbol = Symbol('hidden');
const VISIBLE: unique symbol = Symbol('visible');
const APPENDS: unique symbol = Symbol('appends');

/** Determine whether a value is a plain object, i.e. a multi-attribute mutator result. */
function plain(value: unknown): value is AttributeBag {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // getPrototypeOf returns any; the value is an object here, so its prototype is object | null.
  const prototype: object | null = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

/** Deep-copy plain data for a snapshot, carrying exotic values by reference. */
function snapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry: unknown): unknown => snapshot(entry));
  }
  if (plain(value)) {
    const copied: AttributeBag = {};
    for (const [key, entry] of Object.entries(value)) {
      copied[key] = snapshot(entry);
    }
    return copied;
  }
  // Class instances, Dates, and proxied models cannot be structured-cloned safely;
  // carrying them by reference keeps sync() total, and dirty comparison still works
  // because unchanged references compare identical.
  return value;
}

/** Compare a current and original raw value for dirty tracking. */
function equivalent(current: unknown, original: unknown): boolean {
  if (Object.is(current, original)) {
    return true;
  }
  // Only plain data (json casts) compares structurally; distinct exotic references
  // are never equivalent — two different model instances both stringify to '{}',
  // so JSON.stringify cannot prove anything about them.
  if ((plain(current) || Array.isArray(current)) && (plain(original) || Array.isArray(original))) {
    return JSON.stringify(current) === JSON.stringify(original);
  }
  return false;
}

// Note: in-place mutation of a by-reference exotic value (e.g. mutating a nested model
// held in both ORIGINAL and ATTRIBUTES) is undetectable by design — Eloquent shares
// the same blind spot with PHP object handles. snapshot() only copies plain data.

/** Base class providing Eloquent-style attributes, casts, and accessors/mutators. */
// Deviation from the brief: `A extends AttributeBag` is dropped (kept as `A = AttributeBag`).
// Plain interfaces (e.g. the brief's own UserAttributes) have no index signature, so they fail
// the `extends Record<string, unknown>` constraint on a class-extends type argument (TS2344);
// none of the members below need the constraint structurally, only `keyof A`/`A[K]`/`Partial<A>`.
export class Model<A = AttributeBag> {
  /** When true, mass assignment of non-fillable keys throws instead of discarding. */
  static strict: boolean = false;

  /** Create a model from trusted raw data, bypassing guards and mutators, synced clean. */
  // `Model` (no type argument) defaults to `Model<AttributeBag>`; because A is invariant
  // through Attribute<A[K]>'s `set` parameter, a subclass like `Model<ItemAttributes>` is not
  // structurally assignable to that default, so the constraint is widened to `Model<any>`.
  static hydrate<T extends Model<any>>(this: new () => T, attributes: AttributeBag): T {
    const model: T = new this();
    // Full raw replacement mirrors Eloquent's newFromBuilder: no defaults survive, no set pipeline runs.
    model[ATTRIBUTES] = { ...attributes };
    return model.sync();
  }

  declare [ATTRIBUTES]: AttributeBag;
  declare [ORIGINAL]: AttributeBag;
  declare [MEMO]: Map<string, unknown>;
  declare [HIDDEN]: Set<string>;
  declare [VISIBLE]: Set<string>;
  declare [APPENDS]: Set<string>;

  /** Create a new model, applying defaults, syncing, then mass-filling the given attributes. */
  constructor(attributes: Partial<A> = {}) {
    this[ATTRIBUTES] = {};
    this[ORIGINAL] = {};
    this[MEMO] = new Map<string, unknown>();
    this[HIDDEN] = new Set<string>(this.hidden());
    this[VISIBLE] = new Set<string>(this.visible());
    this[APPENDS] = new Set<string>(this.appends());
    // Eloquent order: defaults are applied and synced clean, then fill() marks its writes as changes.
    this.forceFill(this.defaults());
    this.sync();
    this.fill(attributes);
    // Returning a Proxy from the constructor makes every `new` instance proxied.
    return new Proxy(this, handler()) as this;
  }

  /** Get an attribute value, applying accessors and casts. */
  get<K extends keyof A & string>(key: K): A[K] {
    // The pipeline works on unknowns; the attribute interface vouches for the shape.
    return this.transform(key, this[ATTRIBUTES], this[MEMO]) as A[K];
  }

  /** Set an attribute value, applying mutators and cast normalization. */
  set<K extends keyof A & string>(key: K, value: A[K]): this {
    this[MEMO].delete(key);
    const definition: Attribute<A[K]> | undefined = this.attributes()[key];
    if (definition !== undefined && definition.set !== undefined) {
      const result: unknown = definition.set(value, this[ATTRIBUTES]);
      if (plain(result)) {
        // A plain-object result writes multiple raw attributes (Eloquent-faithful);
        // to store a plain object as a value, return { [key]: object } from the mutator.
        for (const [written, raw] of Object.entries(result)) {
          this[ATTRIBUTES][written] = raw;
          this[MEMO].delete(written);
        }
      } else {
        this[ATTRIBUTES][key] = result;
      }
      return this;
    }
    const cast: CastType | Cast | undefined = this.casts()[key];
    if (cast !== undefined) {
      this[ATTRIBUTES][key] = castSet(cast, value, key, this[ATTRIBUTES]);
      return this;
    }
    this[ATTRIBUTES][key] = value;
    return this;
  }

  /** Apply the accessor/cast get pipeline for one key against the given raw bag. */
  protected transform(key: string, attributes: AttributeBag, memo?: Map<string, unknown>): unknown {
    // Indexing the mapped config types by a plain string needs a widened view.
    const definition: Attribute | undefined = (this.attributes() as Record<string, Attribute | undefined>)[key];
    // Accessors win over casts and receive the raw value (Eloquent's transformModelValue order).
    if (definition !== undefined && definition.get !== undefined) {
      return definition.get(attributes[key], attributes);
    }
    const cast: CastType | Cast | undefined = (this.casts() as Record<string, CastType | Cast | undefined>)[key];
    if (cast !== undefined) {
      if (memo !== undefined && memo.has(key)) {
        return memo.get(key);
      }
      const value: unknown = castGet(cast, attributes[key], key, attributes);
      // Object results are memoized so repeated reads return the same instance.
      if (memo !== undefined && typeof value === 'object' && value !== null) {
        memo.set(key, value);
      }
      return value;
    }
    return attributes[key];
  }

  /** Mass assign attributes, honoring the fillable/guarded rules. */
  fill(attributes: Partial<A>): this {
    const fillable: readonly string[] = this.fillable();
    const guarded: readonly string[] = this.guarded();
    for (const [key, value] of Object.entries(attributes)) {
      // The fillable whitelist wins when both lists are declared (Eloquent's isFillable order).
      const allowed: boolean = fillable.length > 0 ? fillable.includes(key) : !guarded.includes(key);
      if (allowed) {
        // Object.entries erases the key/value pairing; set() re-applies it.
        this.set(key as keyof A & string, value as A[keyof A & string]);
        // this.constructor is typed Function; the static strict flag lives on the Model constructor.
      } else if ((this.constructor as typeof Model).strict) {
        throw new MassAssignmentError(`Add [${key}] to the fillable list to enable mass assignment on [${this.constructor.name}].`);
      }
    }
    return this;
  }

  /** Mass assign attributes, bypassing all guarding. */
  forceFill(attributes: Partial<A>): this {
    for (const [key, value] of Object.entries(attributes)) {
      // Object.entries erases the key/value pairing; set() re-applies it.
      this.set(key as keyof A & string, value as A[keyof A & string]);
    }
    return this;
  }

  /** Get a copy of the raw stored attributes, or a single raw value. */
  raw(): AttributeBag;
  raw(key: keyof A & string): unknown;
  raw(key?: keyof A & string): unknown {
    return key === undefined ? { ...this[ATTRIBUTES] } : this[ATTRIBUTES][key];
  }

  /** Determine whether an attribute is present, raw or virtual. */
  has(key: string): boolean {
    // Only a definition with a get accessor makes a key readable as a virtual.
    const definition: Attribute | undefined = (this.attributes() as Record<string, Attribute | undefined>)[key];
    return key in this[ATTRIBUTES] || (definition !== undefined && definition.get !== undefined);
  }

  /** Remove an attribute from raw storage. */
  forget(key: keyof A & string): this {
    delete this[ATTRIBUTES][key];
    this[MEMO].delete(key);
    return this;
  }

  /** Snapshot the current raw attributes as the original state. */
  sync(): this {
    // snapshot() prevents json-cast objects from aliasing between current and original.
    // The top-level bag is always a plain object, so the cast back is plumbing only.
    this[ORIGINAL] = snapshot(this[ATTRIBUTES]) as AttributeBag;
    this[MEMO].clear();
    return this;
  }

  /** Determine whether any (or any of the given) attributes changed since the last sync. */
  dirty(...keys: (keyof A & string)[]): boolean {
    const changed: AttributeBag = this.changes();
    if (keys.length === 0) {
      return Object.keys(changed).length > 0;
    }
    return keys.some((key: keyof A & string): boolean => key in changed);
  }

  /** Get the raw attributes that changed since the last sync. */
  changes(): AttributeBag {
    const changed: AttributeBag = {};
    for (const [key, value] of Object.entries(this[ATTRIBUTES])) {
      if (!(key in this[ORIGINAL]) || !equivalent(value, this[ORIGINAL][key])) {
        changed[key] = value;
      }
    }
    return changed;
  }

  /** Get the original (last-synced) attributes with casts applied, or one of them. */
  original(): AttributeBag;
  original(key: keyof A & string): unknown;
  original(key?: keyof A & string): unknown {
    if (key !== undefined) {
      return this.transform(key, this[ORIGINAL]);
    }
    const output: AttributeBag = {};
    for (const name of Object.keys(this[ORIGINAL])) {
      output[name] = this.transform(name, this[ORIGINAL]);
    }
    return output;
  }

  /** Revert the raw attributes to the last-synced original state. */
  discard(): this {
    // snapshot() deep-copies plain data; exotic values are carried by reference (see sync()).
    this[ATTRIBUTES] = snapshot(this[ORIGINAL]) as AttributeBag;
    this[MEMO].clear();
    return this;
  }

  /** Serialize the model to a plain object, applying casts, accessors, appends, and visibility. */
  toJSON(): AttributeBag {
    const output: AttributeBag = {};
    const keys: Set<string> = new Set<string>([...Object.keys(this[ATTRIBUTES]), ...this[APPENDS]]);
    for (const key of keys) {
      // A non-empty visible whitelist wins first; the hidden blacklist filters the rest.
      if (this[VISIBLE].size > 0 && !this[VISIBLE].has(key)) {
        continue;
      }
      if (this[HIDDEN].has(key)) {
        continue;
      }
      output[key] = this.transform(key, this[ATTRIBUTES], this[MEMO]);
    }
    return output;
  }

  /** Get a cast-applied subset of the attributes. */
  only<K extends keyof A & string>(...keys: K[]): Pick<A, K> {
    const output: AttributeBag = {};
    for (const key of keys) {
      output[key] = this.get(key);
    }
    // Built key by key from K, so the pick shape holds.
    return output as Pick<A, K>;
  }

  /** Get all cast-applied attributes except the given keys. */
  except<K extends keyof A & string>(...keys: K[]): AttributeBag {
    const output: AttributeBag = {};
    for (const key of Object.keys(this[ATTRIBUTES])) {
      // Object.keys() widens to string; narrow back to K for the membership check.
      if (!keys.includes(key as K)) {
        output[key] = this.transform(key, this[ATTRIBUTES], this[MEMO]);
      }
    }
    return output;
  }

  /** Hide the given keys from serialization at runtime. */
  hide(...keys: (keyof A & string)[]): this {
    for (const key of keys) {
      this[HIDDEN].add(key);
    }
    return this;
  }

  /** Make the given keys visible in serialization at runtime. */
  show(...keys: (keyof A & string)[]): this {
    for (const key of keys) {
      this[HIDDEN].delete(key);
      // A non-empty whitelist must also include the key for it to appear.
      if (this[VISIBLE].size > 0) {
        this[VISIBLE].add(key);
      }
    }
    return this;
  }

  /** Append the given virtual keys to serialization at runtime. */
  append(...keys: (keyof A & string)[]): this {
    for (const key of keys) {
      this[APPENDS].add(key);
    }
    return this;
  }

  /** Get the attributes that should be cast. */
  protected casts(): Casts<A> {
    return {};
  }

  /** Get the accessor and mutator definitions. */
  protected attributes(): Attributes<A> {
    return {};
  }

  /** Get the attribute keys that are mass assignable. */
  protected fillable(): (keyof A & string)[] {
    return [];
  }

  /** Get the attribute keys that are guarded from mass assignment. */
  protected guarded(): (keyof A & string)[] {
    return [];
  }

  /** Get the attribute keys hidden from serialization. */
  protected hidden(): (keyof A & string)[] {
    return [];
  }

  /** Get the serialization whitelist. */
  protected visible(): (keyof A & string)[] {
    return [];
  }

  /** Get the virtual keys appended to serialization. */
  protected appends(): (keyof A & string)[] {
    return [];
  }

  /** Get the default attribute values. */
  protected defaults(): Partial<A> {
    return {};
  }
}
