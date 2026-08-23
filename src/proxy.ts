/** Structural surface the proxy traps require from a model instance. */
export interface Proxied {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
  has(key: string): boolean;
  forget(key: string): unknown;
}

/** Create the proxy handler that routes unknown properties to attribute access. */
export function handler<TTarget extends Proxied>(): ProxyHandler<TTarget> {
  return {
    /** Route reads of unknown properties through the model's attribute getter. */
    get(target: TTarget, property: string | symbol, receiver: unknown): unknown {
      // Symbols and declared class members resolve normally; class members shadow attributes.
      if (typeof property === 'symbol' || property in target) {
        return Reflect.get(target, property, receiver);
      }
      return target.get(property);
    },

    /** Route writes of unknown properties through the model's attribute setter. */
    set(target: TTarget, property: string | symbol, value: unknown, receiver: unknown): boolean {
      if (typeof property === 'symbol' || property in target) {
        return Reflect.set(target, property, value, receiver);
      }
      target.set(property, value);
      return true;
    },

    /** Report attribute presence for the `in` operator. */
    has(target: TTarget, property: string | symbol): boolean {
      if (typeof property === 'symbol') {
        return property in target;
      }
      if (property in target) {
        return true;
      }
      return target.has(property);
    },

    /** Remove an attribute when an unknown property is deleted. */
    deleteProperty(target: TTarget, property: string | symbol): boolean {
      if (typeof property === 'symbol' || property in target) {
        return Reflect.deleteProperty(target, property);
      }
      target.forget(property);
      return true;
    },
  };
}
