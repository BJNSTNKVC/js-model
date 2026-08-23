import { describe, expect, it } from 'vitest';
import { handler, type Proxied } from '../src/proxy';

const MARKER: unique symbol = Symbol('marker');

/** Minimal stand-in for a model that records attribute access. */
class Stub implements Proxied {
  // Optional so the delete-operator test typechecks.
  declare [MARKER]?: string;
  bag: Record<string, unknown> = {};

  /** Read an attribute from the bag. */
  get(key: string): unknown {
    return this.bag[key];
  }

  /** Write an attribute into the bag. */
  set(key: string, value: unknown): unknown {
    this.bag[key] = value;
    return this;
  }

  /** Report whether the bag holds the key. */
  has(key: string): boolean {
    return key in this.bag;
  }

  /** Remove the key from the bag. */
  forget(key: string): unknown {
    delete this.bag[key];
    return this;
  }

  /** Identify the stub for member-shadowing tests. */
  label(): string {
    return 'stub';
  }
}

/** Create a proxied stub for each test. */
function wrap(): Stub {
  return new Proxy(new Stub(), handler());
}

describe('handler', () => {
  it('routes unknown property reads and writes to attribute access', () => {
    const stub: Stub = wrap()
    ;(stub as unknown as Record<string, unknown>)['name'] = 'Bojan';
    expect((stub as unknown as Record<string, unknown>)['name']).toBe('Bojan');
    expect(stub.bag['name']).toBe('Bojan');
  });

  it('lets class members shadow attributes', () => {
    const stub: Stub = wrap();
    stub.set('label', 'attribute');
    expect(stub.label()).toBe('stub'); // the method wins over the attribute
    expect(stub.get('label')).toBe('attribute'); // escape hatch still reaches it
  });

  it('resolves declared instance properties normally', () => {
    const stub: Stub = wrap();
    stub.bag = { kept: true };
    expect(stub.bag).toEqual({ kept: true }); // `bag` is a member, not an attribute
  });

  it('passes symbol properties straight through', () => {
    const stub: Stub = wrap();
    stub[MARKER] = 'internal';
    expect(stub[MARKER]).toBe('internal');
    expect(stub.bag[MARKER as unknown as string]).toBeUndefined();
  });

  it('supports the in operator for attributes and members', () => {
    const stub: Stub = wrap();
    stub.set('email', 'a@b.c');
    expect('email' in stub).toBe(true);
    expect('label' in stub).toBe(true);
    expect('missing' in stub).toBe(false);
  });

  it('deletes attributes via deleteProperty and members via reflection', () => {
    const stub: Stub = wrap();
    stub.set('email', 'a@b.c');
    delete (stub as unknown as Record<string, unknown>)['email'];
    expect(stub.has('email')).toBe(false);
    stub[MARKER] = 'internal';
    delete stub[MARKER];
    expect(MARKER in stub).toBe(false);
  });
});
