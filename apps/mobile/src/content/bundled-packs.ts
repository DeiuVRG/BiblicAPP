import placeholderManifest from '../../assets/packs/placeholder/manifest.json';
import placeholderPack from '../../assets/packs/placeholder/pack.json';

export interface BundledPack {
  /** Parsed manifest.json (untrusted until verified). */
  manifest: unknown;
  /** Parsed pack.json (untrusted until verified). */
  pack: unknown;
}

/**
 * Packs shipped inside the app. Metro needs static requires, so every bundled pack is listed
 * here explicitly. Add new packs to this array.
 */
export const bundledPacks: readonly BundledPack[] = [
  { manifest: placeholderManifest, pack: placeholderPack },
];
