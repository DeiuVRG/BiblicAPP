const CORE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

/** Parses the `major.minor.patch` core of a semver string; prerelease/build parts are ignored. */
export function parseSemver(version: string): [number, number, number] | null {
  const match = CORE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compares two semver strings by their `major.minor.patch` core.
 * Returns a negative number, zero or a positive number. Throws on malformed input.
 */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    throw new TypeError(`compareSemver: malformed version (${a}, ${b})`);
  }
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] as number) - (right[i] as number);
    if (diff !== 0) return diff;
  }
  return 0;
}
