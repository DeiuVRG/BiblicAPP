import catalogueJson from '../../assets/catalogue/catalogue.json';
import catalogueManifest from '../../assets/catalogue/manifest.json';

export interface BundledCatalogue {
  /** Parsed manifest.json (untrusted until verified). */
  manifest: unknown;
  /** Parsed catalogue.json (untrusted until verified). */
  catalogue: unknown;
}

/**
 * The signed catalogue shipped inside the app, next to the packs (docs/ui-spec-v2.md, 6.8;
 * ADR-018). Metro needs a static require, so it is listed here. It is verified (schema, sha256,
 * Ed25519 signature against the pinned keys) before anything reads it. Rebuild it with
 * `pnpm --filter @biblioteca/content-tools cli build-catalogue` whenever a pack changes.
 */
export const bundledCatalogue: BundledCatalogue = {
  manifest: catalogueManifest as unknown,
  catalogue: catalogueJson as unknown,
};
