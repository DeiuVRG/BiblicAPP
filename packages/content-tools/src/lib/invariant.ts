/** Returns the value or throws: for lookups that the surrounding code has already guaranteed. */
export function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`internal error: missing ${what}`);
  return value;
}
