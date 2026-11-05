import {
  CatalogueManifestSchema,
  CatalogueSchema,
  canonicalJsonBytes,
  catalogueSigningPayload,
  compareSemver,
} from '@biblioteca/shared';
import type { Catalogue, CatalogueManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { getAppVersion } from '@/content/app-version';
import { trustedKeys as defaultTrustedKeys } from '@/content/trusted-keys';
import { base64ToBytes } from '@/content/verify-pack';
import type { TrustedKey } from '@/content/verify-pack';

import { bundledCatalogue } from './bundled-catalogue';
import type { BundledCatalogue } from './bundled-catalogue';

// `@/content/verify-pack` sets the synchronous SHA-512 that @noble/ed25519 needs (Hermes has no
// WebCrypto); importing it above is what makes `ed.verify` work here.

export type CatalogueFailureReason =
  | 'manifest-invalid'
  | 'catalogue-invalid'
  | 'size-mismatch'
  | 'sha256-mismatch'
  | 'unknown-key'
  | 'bad-signature'
  | 'app-too-old';

export interface VerifyCatalogueInput {
  /** Parsed manifest.json (untrusted). */
  manifest: unknown;
  /** Parsed catalogue.json (untrusted). Hashed via its canonical JSON bytes. */
  catalogue: unknown;
  trustedKeys: readonly TrustedKey[];
  /** The running app version; `undefined` when it cannot be read (fail closed, as for packs). */
  appVersion: string | undefined;
}

export type VerifyCatalogueResult =
  | { ok: true; manifest: CatalogueManifest; catalogue: Catalogue; signatureVerified: true }
  | { ok: false; reason: CatalogueFailureReason; detail?: string };

/**
 * Verifies the signed catalogue once, at start, before anything counts, lists or describes from it:
 *
 *   1. manifest and catalogue match their schemas (including the reference integrity of the
 *      catalogue: unique slugs, every shelf, author and pack reference resolves),
 *   2. `size` and `sha256` match the canonical bytes of catalogue.json (stored in canonical form,
 *      so the bytes are recomputed from the parsed object, as for packs),
 *   3. `signingKeyId` is one of the pinned keys and the Ed25519 signature over the manifest
 *      (without its `signature` field) verifies with that key,
 *   4. the running app is at least `minAppVersion` (an unknown version counts as too old).
 *
 * Any failure returns `{ ok: false }`: the caller must not read a count, a shelf or a blurb from
 * the rejected file.
 */
export async function verifyCatalogue(input: VerifyCatalogueInput): Promise<VerifyCatalogueResult> {
  const manifestResult = CatalogueManifestSchema.safeParse(input.manifest);
  if (!manifestResult.success) {
    return { ok: false, reason: 'manifest-invalid', detail: manifestResult.error.message };
  }
  const catalogueResult = CatalogueSchema.safeParse(input.catalogue);
  if (!catalogueResult.success) {
    return { ok: false, reason: 'catalogue-invalid', detail: catalogueResult.error.message };
  }
  const manifest = manifestResult.data;

  const bytes = canonicalJsonBytes(input.catalogue);
  if (bytes.length !== manifest.size) return { ok: false, reason: 'size-mismatch' };
  if (bytesToHex(sha256(bytes)) !== manifest.sha256)
    return { ok: false, reason: 'sha256-mismatch' };

  const key = input.trustedKeys.find((candidate) => candidate.id === manifest.signingKeyId);
  if (!key) return { ok: false, reason: 'unknown-key', detail: manifest.signingKeyId };
  let signatureValid = false;
  try {
    signatureValid = ed.verify(
      base64ToBytes(manifest.signature),
      catalogueSigningPayload(manifest),
      base64ToBytes(key.publicKey),
      { zip215: false }, // strict RFC 8032 verification
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { ok: false, reason: 'bad-signature' };

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

  return { ok: true, manifest, catalogue: catalogueResult.data, signatureVerified: true };
}

/** What the app knows of its catalogue after the one verification at start. */
export type CatalogueState =
  | { status: 'verified'; catalogue: Catalogue; manifest: CatalogueManifest }
  | { status: 'rejected'; reason: CatalogueFailureReason; detail?: string }
  /** There is no catalogue (a test, a build without one): everything lists under "Altele". */
  | { status: 'missing' };

export interface CatalogueLoadOptions {
  /** Defaults to the catalogue bundled with the app; `null` means none. */
  bundled?: BundledCatalogue | null;
  trustedKeys?: readonly TrustedKey[];
  appVersion?: string;
  /** Injectable for tests. */
  verify?: typeof verifyCatalogue;
}

/** The state to use when no catalogue is given: nothing is known beyond the packs themselves. */
export const NO_CATALOGUE: CatalogueState = { status: 'missing' };

/** Verifies the bundled catalogue (the one signature check of the start) and says what came of it. */
export async function loadBundledCatalogue(
  options: CatalogueLoadOptions = {},
): Promise<CatalogueState> {
  const bundled = options.bundled === undefined ? bundledCatalogue : options.bundled;
  if (bundled === null) return NO_CATALOGUE;
  const verify = options.verify ?? verifyCatalogue;
  const result = await verify({
    manifest: bundled.manifest,
    catalogue: bundled.catalogue,
    trustedKeys: options.trustedKeys ?? defaultTrustedKeys,
    appVersion: options.appVersion ?? getAppVersion(),
  });
  // A verifier that accepts without having checked the signature is not good enough.
  if (result.ok && result.signatureVerified === true) {
    return { status: 'verified', catalogue: result.catalogue, manifest: result.manifest };
  }
  if (result.ok) return { status: 'rejected', reason: 'bad-signature', detail: 'unverified' };
  return { status: 'rejected', reason: result.reason, detail: result.detail };
}
