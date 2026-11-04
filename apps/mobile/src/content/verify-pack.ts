import {
  PackManifestSchema,
  PackSchema,
  canonicalJsonBytes,
  compareSemver,
  manifestSigningPayload,
} from '@biblioteca/shared';
import type { Pack, PackManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// The synchronous @noble/ed25519 API needs SHA-512 supplied explicitly; this keeps verification
// independent of WebCrypto, which Hermes does not provide.
ed.hashes.sha512 = sha512;

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
  | 'bad-signature'
  | 'unverified'
  // Not found by `verifyPack` (it sees one pack): the repository finds them when it puts verified
  // packs together. The later pack of a clash is rejected.
  | 'duplicate-edition'
  | 'duplicate-id';

export interface VerifyPackInput {
  /** Parsed manifest.json (untrusted). */
  manifest: unknown;
  /** Parsed pack.json (untrusted). Hashed via its canonical JSON bytes. */
  pack: unknown;
  trustedKeys: readonly TrustedKey[];
  /**
   * Running app version, used to enforce `minAppVersion`. Required on purpose: pass `undefined`
   * when it cannot be read, in which case packs that need more than 0.0.0 are refused (fail
   * closed).
   */
  appVersion: string | undefined;
}

export type VerifyPackResult =
  | { ok: true; manifest: PackManifest; pack: Pack; signatureVerified: true }
  | { ok: false; reason: VerifyFailureReason; detail?: string };

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes standard base64 (with padding) without relying on `atob` or `Buffer`. */
export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const ch of clean) {
    const value = BASE64_ALPHABET.indexOf(ch);
    if (value < 0) throw new Error('invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }
  return out.subarray(0, index);
}

/**
 * Verifies a content pack before the app is allowed to show it. Every step must pass:
 *
 *   1. manifest and pack match their schemas (including reference integrity),
 *   2. manifest and pack describe the same work and edition,
 *   3. `size` and `sha256` match the canonical bytes of pack.json (pack.json is stored in
 *      canonical form, see ADR-006, so the bytes are recomputed from the parsed object),
 *   4. `signingKeyId` is one of the pinned keys and the Ed25519 signature over the manifest
 *      (without its `signature` field) verifies with that key,
 *   5. the running app is at least `minAppVersion`; an unknown app version counts as too old
 *      for any pack that requires more than 0.0.0 (fail closed).
 *
 * Any failure returns `{ ok: false }`; callers must not show the pack. Success always carries
 * `signatureVerified: true`; the repository refuses anything else.
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

  const bytes = canonicalJsonBytes(input.pack);
  if (bytes.length !== manifest.size) {
    return { ok: false, reason: 'size-mismatch' };
  }
  if (bytesToHex(sha256(bytes)) !== manifest.sha256) {
    return { ok: false, reason: 'sha256-mismatch' };
  }

  const key = input.trustedKeys.find((candidate) => candidate.id === manifest.signingKeyId);
  if (!key) {
    return { ok: false, reason: 'unknown-key', detail: manifest.signingKeyId };
  }
  let signatureValid = false;
  try {
    signatureValid = ed.verify(
      base64ToBytes(manifest.signature),
      manifestSigningPayload(manifest),
      base64ToBytes(key.publicKey),
      { zip215: false }, // strict RFC 8032 verification
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return { ok: false, reason: 'bad-signature' };
  }

  let tooOld: boolean;
  try {
    tooOld =
      input.appVersion === undefined
        ? compareSemver(manifest.minAppVersion, '0.0.0') > 0
        : compareSemver(input.appVersion, manifest.minAppVersion) < 0;
  } catch {
    tooOld = true; // fail closed on an unreadable version
  }
  if (tooOld) {
    return { ok: false, reason: 'app-too-old', detail: `requires ${manifest.minAppVersion}` };
  }

  return { ok: true, manifest, pack, signatureVerified: true };
}
