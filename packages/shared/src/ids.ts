import { monotonicFactory } from 'ulid';

const factory = monotonicFactory();

/**
 * Generates a stable, sortable, URL-safe identifier (ULID: 26 chars, Crockford base32).
 * IDs are generated ONCE at ingest and never regenerated; callers must persist them.
 * Pass `seedTime` for deterministic ordering in tests.
 */
export function stableId(seedTime?: number): string {
  return factory(seedTime);
}

/** Matches a ULID (Crockford base32, 26 chars). */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value: string): boolean {
  return ULID_PATTERN.test(value);
}
