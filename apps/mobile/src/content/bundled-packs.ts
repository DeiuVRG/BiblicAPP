import vosManifest from '../../assets/packs/vos-1903-kingdom-en/manifest.json';
import vosPack from '../../assets/packs/vos-1903-kingdom-en/pack.json';

export interface BundledPack {
  /** Parsed manifest.json (untrusted until verified). */
  manifest: unknown;
  /** Parsed pack.json (untrusted until verified). */
  pack: unknown;
}

/**
 * Packs shipped inside the app. Metro needs static requires, so every bundled pack is listed
 * here explicitly. Add new packs to this array. Every pack is verified (schema, sha256, Ed25519
 * signature against the pinned keys) before it is shown.
 */
export const bundledPacks: readonly BundledPack[] = [
  { manifest: vosManifest as unknown, pack: vosPack as unknown },
];
