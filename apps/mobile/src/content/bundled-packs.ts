import vosEnglishManifest from '../../assets/packs/vos-1903-kingdom-en/manifest.json';
import vosEnglishPack from '../../assets/packs/vos-1903-kingdom-en/pack.json';
import vosRomanianManifest from '../../assets/packs/vos-1903-kingdom-ro/manifest.json';
import vosRomanianPack from '../../assets/packs/vos-1903-kingdom-ro/pack.json';

export interface BundledPack {
  /** Parsed manifest.json (untrusted until verified). */
  manifest: unknown;
  /** Parsed pack.json (untrusted until verified). */
  pack: unknown;
}

/**
 * Packs shipped inside the app. Metro needs static requires, so every bundled pack is listed
 * here explicitly. Add new packs to this array. Every pack is verified (schema, sha256, Ed25519
 * signature against the pinned keys) before it is shown. Packs with the same `work.id` are two
 * editions of one work (the source first, then its translations).
 */
export const bundledPacks: readonly BundledPack[] = [
  { manifest: vosEnglishManifest as unknown, pack: vosEnglishPack as unknown },
  // A partial translation (the sections translated so far) aligned to the English edition.
  { manifest: vosRomanianManifest as unknown, pack: vosRomanianPack as unknown },
];
