/**
 * Deterministic JSON serialisation used for hashing and signing.
 *
 * Rules: object keys sorted by UTF-16 code unit order, no whitespace, `undefined` object
 * properties omitted (like JSON.stringify), `undefined` array items rejected, non-finite
 * numbers rejected, only plain data (null, boolean, number, string, array, plain object).
 */
export function canonicalJson(value: unknown): string {
  return serialise(value, '$');
}

function serialise(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson: non-finite number at ${path}`);
      }
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        const items = value.map((item, index) => {
          if (item === undefined) {
            throw new TypeError(`canonicalJson: undefined array item at ${path}[${index}]`);
          }
          return serialise(item, `${path}[${index}]`);
        });
        return `[${items.join(',')}]`;
      }
      const proto = Object.getPrototypeOf(value) as unknown;
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError(`canonicalJson: unsupported object at ${path}`);
      }
      const record = value as Record<string, unknown>;
      const parts: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const item = record[key];
        if (item === undefined) continue;
        parts.push(`${JSON.stringify(key)}:${serialise(item, `${path}.${key}`)}`);
      }
      return `{${parts.join(',')}}`;
    }
    default:
      throw new TypeError(`canonicalJson: unsupported ${typeof value} at ${path}`);
  }
}

/** UTF-8 bytes of {@link canonicalJson}. These are the bytes hashed as `sha256` of pack.json. */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}
