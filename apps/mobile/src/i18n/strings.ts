import type { ro } from './ro';

/** Every string becomes `string` (not its literal), every function keeps its parameters. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer Args) => infer Result
    ? (...args: Args) => Widen<Result>
    : T extends object
      ? { readonly [Key in keyof T]: Widen<T[Key]> }
      : T;

/**
 * The shape of an interface-language table, shared by `ro.ts` and `en.ts`. It is derived from the
 * Romanian table, so a key that `en.ts` misses (or invents) is a type error.
 */
export type Strings = Widen<typeof ro>;
