import { PackManifestSchema, PackSchema, canonicalJsonBytes } from '@biblioteca/shared';
import type { Pack, PackManifest } from '@biblioteca/shared';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/** A pinned Ed25519 public key (base64, 32 bytes). The app pins two: current and next. */
export interface TrustedKey {
  id: string;
  publicKey: string;
}

export type VerifyFailureReason =
  | 'manifest-invalid'
  | 'pack-invalid'
  | 'identity-mismatch'
  | 'size-mismatch'
  | 'sha256-mismatch'
  | 'app-too-old'
  | 'unknown-key'
  | 'bad-signature';

export interface VerifyPackInput {
  /** Parsed manifest.json (untrusted). */
  manifest: unknown;
  /** Parsed pack.json (untrusted). Hashed via its canonical JSON bytes. */
  pack: unknown;
  trustedKeys: readonly TrustedKey[];
  /** Running app version, used to enforce `minAppVersion`. Skipped when omitted. */
  appVersion?: string;
}

export type VerifyPackResult =
  | { ok: true; manifest: PackManifest; pack: Pack; signatureVerified: boolean }
  | { ok: false; reason: VerifyFailureReason; detail?: string };

/**
 * Verifies a content pack before the app is allowed to show it.
 *
 * Final signature, shared with the UI: `verifyPack(input): Promise<VerifyPackResult>`.
 *
 * STUB (M0 scaffold): schema validation, identity, size and sha256 checks are real; the Ed25519
 * signature and `minAppVersion` checks are NOT yet implemented. The signature agent must:
 *   1. look up `manifest.signingKeyId` in `trustedKeys` (else 'unknown-key'),
 *   2. verify `manifest.signature` over `manifestSigningPayload(manifest)` with @noble/ed25519
 *      (set `ed.hashes.sha512` from @noble/hashes so it works without WebCrypto),
 *   3. return `signatureVerified: true` only then, and fail with 'bad-signature' otherwise,
 *   4. enforce `minAppVersion` ('app-too-old').
 * Until then results carry `signatureVerified: false`.
 */
export async function verifyPack(input: VerifyPackInput): Promise<VerifyPackResult> {
  const manifestResult = PackManifestSchema.safeParse(input.manifest);
  if (!manifestResult.success) {
    return { ok: false, reason: 'manifest-invalid', detail: manifestResult.error.message };
  }
  const packResult = PackSchema.safeParse(input.pack);
  if (!packResult.success) {
    return { ok: false, reason: 'pack-invalid', detail: packResult.error.message };
  }
  const manifest = manifestResult.data;
  const pack = packResult.data;

  if (manifest.workId !== pack.work.id || manifest.editionId !== pack.edition.id) {
    return { ok: false, reason: 'identity-mismatch' };
  }

  // pack.json is stored in canonical form, so the bytes can be recomputed from the parsed object.
  const bytes = canonicalJsonBytes(input.pack);
  if (bytes.length !== manifest.size) {
    return { ok: false, reason: 'size-mismatch' };
  }
  if (bytesToHex(sha256(bytes)) !== manifest.sha256) {
    return { ok: false, reason: 'sha256-mismatch' };
  }

  // TODO(signature agent): Ed25519 verification and minAppVersion enforcement, see above.
  return { ok: true, manifest, pack, signatureVerified: false };
}
