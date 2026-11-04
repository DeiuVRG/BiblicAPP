import {
  manifestSigningPayload,
  PackManifestSchema,
  PackSchema,
  canonicalJson,
  canonicalJsonBytes,
  compareSemver,
} from '@biblioteca/shared';
import type { Pack, PackManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// @noble/ed25519 needs a synchronous SHA-512 for the sync API.
ed.hashes.sha512 = sha512;

export const ALGORITHM = 'ed25519';

export interface KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface TrustedKey {
  id: string;
  /** Base64 of the 32-byte Ed25519 public key. */
  publicKey: string;
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'base64'));
}

export function generateKeyPair(seed?: Uint8Array): KeyPair {
  const secretKey = ed.utils.randomSecretKey(seed);
  return { secretKey, publicKey: ed.getPublicKey(secretKey) };
}

export function publicKeyFromSecret(secretKey: Uint8Array): Uint8Array {
  return ed.getPublicKey(secretKey);
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export interface BuildPackInput {
  pack: Pack;
  secretKey: Uint8Array;
  signingKeyId: string;
  packId: string;
  version: string;
  revision: number;
  createdAt: string;
  minAppVersion: string;
}

export interface BuiltPack {
  /** Exact bytes of pack.json: the canonical JSON of the pack. */
  packBytes: Uint8Array;
  manifest: PackManifest;
}

/** Validates the pack, serialises it canonically, hashes it and signs the manifest. */
export function buildPack(input: BuildPackInput): BuiltPack {
  const pack = PackSchema.parse(input.pack);
  const packBytes = canonicalJsonBytes(pack);
  const unsigned = {
    packId: input.packId,
    kind: 'edition' as const,
    workId: pack.work.id,
    editionId: pack.edition.id,
    revision: input.revision,
    version: input.version,
    createdAt: input.createdAt,
    sha256: sha256Hex(packBytes),
    size: packBytes.length,
    minAppVersion: input.minAppVersion,
    signingKeyId: input.signingKeyId,
  };
  // The signature is over the manifest without its `signature` field.
  const payload = manifestSigningPayload({ ...unsigned, signature: 'AA==' });
  const signature = toBase64(ed.sign(payload, input.secretKey));
  const manifest = PackManifestSchema.parse({ ...unsigned, signature });
  return { packBytes, manifest };
}

export type VerifyFailure =
  | 'manifest-invalid'
  | 'size-mismatch'
  | 'sha256-mismatch'
  | 'pack-invalid'
  | 'identity-mismatch'
  | 'not-canonical'
  | 'unknown-key'
  | 'bad-signature'
  | 'app-too-old';

export type VerifyResult =
  | { ok: true; manifest: PackManifest; pack: Pack }
  | { ok: false; reason: VerifyFailure; detail?: string };

export interface VerifyInput {
  /** Exact bytes of pack.json. */
  packBytes: Uint8Array;
  /** Parsed manifest.json (untrusted). */
  manifest: unknown;
  trustedKeys: readonly TrustedKey[];
  appVersion?: string;
}

/** Full verification of a pack file pair, byte-exact (used by the CLI and the build step). */
export function verifyPackBytes(input: VerifyInput): VerifyResult {
  const parsedManifest = PackManifestSchema.safeParse(input.manifest);
  if (!parsedManifest.success) {
    return { ok: false, reason: 'manifest-invalid', detail: parsedManifest.error.message };
  }
  const manifest = parsedManifest.data;
  if (input.packBytes.length !== manifest.size) {
    return {
      ok: false,
      reason: 'size-mismatch',
      detail: `${input.packBytes.length} bytes, manifest says ${manifest.size}`,
    };
  }
  if (sha256Hex(input.packBytes) !== manifest.sha256) {
    return { ok: false, reason: 'sha256-mismatch' };
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.packBytes)) as unknown;
  } catch (error) {
    return { ok: false, reason: 'pack-invalid', detail: String(error) };
  }
  const parsedPack = PackSchema.safeParse(json);
  if (!parsedPack.success) {
    return { ok: false, reason: 'pack-invalid', detail: parsedPack.error.message };
  }
  const pack = parsedPack.data;
  if (manifest.workId !== pack.work.id || manifest.editionId !== pack.edition.id) {
    return { ok: false, reason: 'identity-mismatch' };
  }
  // The app recomputes the hash from the parsed object, so the file must be canonical.
  if (canonicalJson(json) !== new TextDecoder().decode(input.packBytes)) {
    return { ok: false, reason: 'not-canonical' };
  }
  const key = input.trustedKeys.find((k) => k.id === manifest.signingKeyId);
  if (!key) return { ok: false, reason: 'unknown-key', detail: manifest.signingKeyId };
  let valid = false;
  try {
    valid = ed.verify(
      fromBase64(manifest.signature),
      manifestSigningPayload(manifest),
      fromBase64(key.publicKey),
      { zip215: false }, // strict RFC 8032 verification, same as the app
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad-signature' };
  if (
    input.appVersion !== undefined &&
    compareSemver(input.appVersion, manifest.minAppVersion) < 0
  ) {
    return { ok: false, reason: 'app-too-old', detail: `needs ${manifest.minAppVersion}` };
  }
  return { ok: true, manifest, pack };
}
