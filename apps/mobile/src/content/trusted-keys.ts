import type { TrustedKey } from './verify-pack';

/**
 * Pinned public keys (current + next). Filled in by the signature work from app config
 * (`extra`/EXPO_PUBLIC_* values: public keys only, never private keys).
 */
export const trustedKeys: readonly TrustedKey[] = [];
