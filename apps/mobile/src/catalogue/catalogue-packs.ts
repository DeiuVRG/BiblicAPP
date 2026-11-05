import {
  PackManifestSchema,
  PackSchema,
  canonicalJsonBytes,
  compareSemver,
} from '@biblioteca/shared';
import type { CataloguePack, Pack, PackManifest } from '@biblioteca/shared';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import type { VerifyFailureReason } from '@/content/verify-pack';

// How a pack is admitted when a verified catalogue lists it (ADR-018): the catalogue is signed and
// carries the sha256 and size of every pack, so the pack's own signature does not have to be
// checked again, and its hash is checked when its edition is first opened or searched, not at
// start. That is what keeps the cold start from growing with the number of packs.

/** A pack the signed catalogue vouches for. Its bytes are checked on first use (`checkPackBytes`). */
export interface CatalogueBackedPack {
  manifest: PackManifest;
  /** The parsed pack (schema-valid, identity-checked). */
  pack: Pack;
  /** The pack as it was loaded: the bytes that were hashed are those of this object. */
  raw: unknown;
  /** What the verified catalogue says about the pack. */
  expected: CataloguePack;
  catalogueVerified: true;
}

export type VouchResult =
  | { ok: true; entry: CatalogueBackedPack }
  | { ok: false; reason: VerifyFailureReason; detail?: string };

interface VouchInput {
  manifest: unknown;
  pack: unknown;
  expected: CataloguePack;
  appVersion: string | undefined;
}

/**
 * The cheap checks of a pack that a verified catalogue lists: the schemas, that manifest, pack and
 * catalogue entry describe the same pack, and `minAppVersion`. A manifest that disagrees with the
 * catalogue is the sign of a pack rebuilt without the catalogue (or the other way round): it is
 * refused at once, without hashing anything.
 */
export function vouchForPack(input: VouchInput): VouchResult {
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
  const { expected } = input;
  if (
    manifest.workId !== pack.work.id ||
    manifest.editionId !== pack.edition.id ||
    expected.packId !== manifest.packId ||
    expected.editionId !== pack.edition.id
  ) {
    return { ok: false, reason: 'identity-mismatch' };
  }
  if (manifest.sha256 !== expected.sha256 || manifest.size !== expected.size) {
    return {
      ok: false,
      reason: 'catalogue-mismatch',
      detail: 'the manifest of the pack differs from its entry in the catalogue',
    };
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
  return {
    ok: true,
    entry: { manifest, pack, raw: input.pack, expected, catalogueVerified: true },
  };
}

/**
 * The expensive check, made when the edition is first opened or searched: the canonical bytes of
 * the pack have the size and the sha256 that the signed catalogue gives. Returns the reason when
 * they do not.
 */
export function checkPackBytes(entry: CatalogueBackedPack): VerifyFailureReason | null {
  const bytes = canonicalJsonBytes(entry.raw);
  if (bytes.length !== entry.expected.size) return 'size-mismatch';
  if (bytesToHex(sha256(bytes)) !== entry.expected.sha256) return 'sha256-mismatch';
  return null;
}
