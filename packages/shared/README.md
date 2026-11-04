# @biblioteca/shared

Shared content model and helpers (TypeScript source, consumed directly by `apps/mobile` and
`packages/content-tools`; no build step).

- `PackManifestSchema`, `PackSchema` (+ `WorkSchema`, `EditionSchema`, `SectionSchema`,
  `ParagraphSchema`): Zod schemas for the signed content pack format (see `docs/m0-spec.md` section 3).
  Some fields are optional and additive, so packs built before they existed stay valid and
  byte-identical: `Work.titleEn` (the English title, for works whose original is not English) and
  `Licence.noteRo` / `Licence.noteEn` (the licence note in the language of the interface; the app
  falls back to `note`).
- `stableId()`: ULID generator for stable work/edition/section/paragraph ids. Generate once at
  ingest, never regenerate.
- `canonicalJson()` / `canonicalJsonBytes()`: deterministic JSON (sorted keys, no whitespace) used
  for hashing and signing. `pack.json` is stored in canonical form, so `manifest.sha256` is the
  SHA-256 of `canonicalJsonBytes(pack)`.
- `manifestSigningPayload(manifest)`: the exact bytes that are Ed25519-signed (canonical JSON of the
  manifest without `signature`).

Scripts: `pnpm --filter @biblioteca/shared test | typecheck | lint`.
