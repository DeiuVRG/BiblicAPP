import { CatalogueSchema, canonicalJsonBytes, catalogueSigningPayload } from '@biblioteca/shared';
import type { Catalogue, CatalogueManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import type { BundledCatalogue } from '@/catalogue/bundled-catalogue';
import { bundledCatalogue } from '@/catalogue/bundled-catalogue';

import { clone } from './packs';
import type { TestSigner } from './packs';

ed.hashes.sha512 = sha512;

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/**
 * Signs a catalogue the way the content tools do: sha256 and size of its canonical JSON in the
 * manifest, Ed25519 over the manifest without its signature (trust `signer.key` to read it).
 */
export function signCatalogue(
  catalogue: Catalogue,
  signer: TestSigner,
  options: { revision?: number; minAppVersion?: string } = {},
): BundledCatalogue {
  const checked = CatalogueSchema.parse(catalogue);
  const bytes = canonicalJsonBytes(checked);
  const manifest: CatalogueManifest = {
    kind: 'catalogue',
    revision: options.revision ?? 1,
    version: '1.0.0',
    createdAt: '2026-11-05T00:00:00.000Z',
    sha256: bytesToHex(sha256(bytes)),
    size: bytes.length,
    minAppVersion: options.minAppVersion ?? '0.1.0',
    signingKeyId: signer.key.id,
    signature: 'AA==',
  };
  manifest.signature = toBase64(ed.sign(catalogueSigningPayload(manifest), signer.secretKey));
  return { manifest, catalogue: checked };
}

/** A deep copy of the bundled catalogue that tests may change (it is untrusted data again). */
export function copyOfBundledCatalogue(): BundledCatalogue {
  return clone(bundledCatalogue);
}
