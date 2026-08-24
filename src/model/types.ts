import type { Attribute } from './Attribute';

export type AttributeBag<T = Record<string, unknown>> = { [K in keyof T]?: unknown } & Record<string, unknown>;

export type Key<A> = (keyof A & string) | (string & {});

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

export type Enum = Record<string, string | number>;

export type Casts<A> = { [K in keyof A & string]?: CastType | Cast | Enum };

export interface Cast<T = unknown> {
    /**
     * Transform the raw attribute value when read.
     */
    get(value: unknown, key: string, attributes: AttributeBag): T;

    /**
     * Transform the value into its raw storage form when written.
     */
    set(value: T, key: string, attributes: AttributeBag): unknown;
}

export type Attributes<A> = { [K in keyof A & string]?: Attribute<A[K]> };
