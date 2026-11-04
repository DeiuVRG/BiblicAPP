import { canonicalJsonBytes } from './canonical-json';
import type { PackManifest } from './schemas';

/**
 * Bytes that are signed (Ed25519) for a manifest: the canonical JSON of the manifest WITHOUT its
 * `signature` field. Both the build tool and the app must use this function.
 */
export function manifestSigningPayload(manifest: PackManifest): Uint8Array {
  const { signature: _signature, ...unsigned } = manifest;
  return canonicalJsonBytes(unsigned);
}
