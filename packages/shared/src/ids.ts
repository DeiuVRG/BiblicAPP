import { monotonicFactory } from 'ulid';

// Not exported from the package index on purpose: `ulid` needs `crypto.getRandomValues` and
// Hermes does not provide it. Only tooling and tests (Node) import `@biblioteca/shared/ids`.
// The factory is also created lazily so that importing this module never throws.
let factory: ReturnType<typeof monotonicFactory> | undefined;

/**
 * Generates a stable, sortable, URL-safe identifier (ULID: 26 chars, Crockford base32).
 * IDs are generated ONCE at ingest and never regenerated; callers must persist them.
 * Pass `seedTime` for deterministic ordering in tests.
 */
export function stableId(seedTime?: number): string {
  factory ??= monotonicFactory();
  return factory(seedTime);
}

export { isUlid, ULID_PATTERN } from './id-pattern';
