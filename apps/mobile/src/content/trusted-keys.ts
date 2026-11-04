import type { TrustedKey } from './verify-pack';

/**
 * Public keys the app trusts for content packs. Two keys are pinned so that a key can be rotated
 * without shipping a signed update that nobody can verify:
 *
 *  - `current`: signs the packs shipped today. This is the DEVELOPMENT key (its private half is
 *    in `content/keys/dev.key`, gitignored, never in the repo). It is replaced by the CI/release
 *    signing key before any real distribution (see docs/security.md).
 *  - `next`: a PLACEHOLDER. Nobody holds its private key, so it cannot sign anything yet. When a
 *    rotation is prepared, the real next public key replaces it and a new app version ships; only
 *    then is the old key retired.
 *
 * Keys are pinned in source on purpose (not read from build-time environment variables or from
 * downloaded configuration): replacing a key then requires a reviewed code change.
 * `content/keys/*.pub` mirror these values; a unit test keeps them in sync.
 */
export const currentKey: TrustedKey = {
  id: 'dev-2026-11',
  publicKey: 'Kwu8DUuR6QX2edyryWa59lueZGy8HxJqcVYzrZqczVc=',
};

export const nextKey: TrustedKey = {
  id: 'next-placeholder-1',
  publicKey: 'AA/9+ui9WNV+wCmJksWVM9gqbSCdTbrumOzuP1atfas=',
};

export const trustedKeys: readonly TrustedKey[] = [currentKey, nextKey];
