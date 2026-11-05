import fs from 'node:fs';
import path from 'node:path';

import {
  CatalogueManifestSchema,
  CatalogueSchema,
  canonicalJson,
  canonicalJsonBytes,
  catalogueSigningPayload,
  compareSemver,
} from '@biblioteca/shared';
import type { Catalogue, CatalogueManifest, Pack, PackManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';

import { fromBase64, sha256Hex, toBase64, verifyPackBytes } from './signing';
import type { TrustedKey } from './signing';
import { UsageError } from './lib/usage-error';

// The signed catalogue of the library (docs/ui-spec-v2.md, 6.8; ADR-018): hand-written editorial
// records (shelves, authors, works) plus the list of the installed packs, built into one canonical
// JSON file and signed with the key that signs the packs. Pure functions here; the command
// (commands/build-catalogue.ts) reads and writes the files.

/** The top-level keys a source file may hold. Arrays are concatenated across the files. */
const SOURCE_KEYS = ['shelves', 'traditions', 'authors', 'works', 'startHere'] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export type CatalogueSource = Partial<Record<SourceKey, unknown[]>>;

/** A pack read from disk and verified against a trusted key. */
export interface InstalledPack {
  manifest: PackManifest;
  pack: Pack;
  /** Where it was read from, for messages. */
  directory: string;
}

/**
 * Merges the parsed source files (in the order given). Each file is an object whose keys are a
 * subset of `shelves`, `traditions`, `authors`, `works` and `startHere`; the arrays are
 * concatenated, and a key that is not one of those is a mistake (a typo would be silently lost).
 */
export function mergeSources(files: readonly { name: string; value: unknown }[]): CatalogueSource {
  const merged: CatalogueSource = {};
  const startHereFiles: string[] = [];
  for (const { name, value } of files) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new UsageError(`${name}: expected a JSON object with ${SOURCE_KEYS.join(', ')}`);
    }
    for (const [key, items] of Object.entries(value)) {
      if (!(SOURCE_KEYS as readonly string[]).includes(key)) {
        throw new UsageError(`${name}: unknown key "${key}" (expected ${SOURCE_KEYS.join(', ')})`);
      }
      if (!Array.isArray(items)) throw new UsageError(`${name}: "${key}" must be an array`);
      const sourceKey = key as SourceKey;
      if (sourceKey === 'startHere') startHereFiles.push(name);
      merged[sourceKey] = [...(merged[sourceKey] ?? []), ...(items as unknown[])];
    }
  }
  if (startHereFiles.length > 1) {
    throw new UsageError(`startHere is in two files: ${startHereFiles.join(', ')}`);
  }
  return merged;
}

/** Reads every `<dir>/*.json` source file, sorted by name. */
export function readSourceFiles(dir: string): { name: string; value: unknown }[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new UsageError(`${dir} is not a directory of catalogue source files`);
  }
  const names = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (names.length === 0) throw new UsageError(`${dir} has no .json source files`);
  return names.map((name) => {
    try {
      return { name, value: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as unknown };
    } catch (error) {
      throw new UsageError(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Reads and verifies every pack of `<packsDir>/<packId>/{manifest,pack}.json` with the trusted
 * keys, so that a catalogue never lists a pack that the app would refuse. Sorted by pack id.
 */
export function readInstalledPacks(
  packsDir: string,
  trustedKeys: readonly TrustedKey[],
): InstalledPack[] {
  if (!fs.existsSync(packsDir) || !fs.statSync(packsDir).isDirectory()) {
    throw new UsageError(`${packsDir} is not a directory of packs`);
  }
  const installed: InstalledPack[] = [];
  for (const name of fs.readdirSync(packsDir).sort()) {
    const directory = path.join(packsDir, name);
    if (!fs.statSync(directory).isDirectory()) continue;
    const manifestFile = path.join(directory, 'manifest.json');
    const packFile = path.join(directory, 'pack.json');
    if (!fs.existsSync(manifestFile) || !fs.existsSync(packFile)) continue;
    const result = verifyPackBytes({
      packBytes: new Uint8Array(fs.readFileSync(packFile)),
      manifest: JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as unknown,
      trustedKeys,
    });
    if (!result.ok) {
      throw new UsageError(
        `pack ${name} does not verify: ${result.reason}${result.detail ? ` (${result.detail})` : ''}`,
      );
    }
    installed.push({ manifest: result.manifest, pack: result.pack, directory });
  }
  return installed.sort((a, b) => a.manifest.packId.localeCompare(b.manifest.packId));
}

export interface BuiltCatalogueBody {
  catalogue: Catalogue;
  /** Installed works that have no editorial entry: they list under "Altele" until they get one. */
  unlisted: { workId: string; slug: string }[];
}

/**
 * Builds the catalogue (without its signature) from the merged sources and the installed packs:
 * adds `packs[]`, validates it with the schema and checks it against the packs (every listed work
 * is installed and has the slug of its pack; every "where to start" paragraph is in the source
 * edition of its work).
 */
export function buildCatalogueBody(
  source: CatalogueSource,
  installed: readonly InstalledPack[],
): BuiltCatalogueBody {
  const parsed = CatalogueSchema.safeParse({
    shelves: source.shelves ?? [],
    ...(source.traditions === undefined ? null : { traditions: source.traditions }),
    authors: source.authors ?? [],
    works: source.works ?? [],
    ...(source.startHere === undefined ? null : { startHere: source.startHere }),
    packs: installed.map(({ manifest }) => ({
      packId: manifest.packId,
      editionId: manifest.editionId,
      sha256: manifest.sha256,
      size: manifest.size,
    })),
  });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new UsageError(`the catalogue is invalid:\n${lines.join('\n')}`);
  }
  const catalogue = parsed.data;

  const packWorks = new Map<string, Pack['work']>();
  const sourceParagraphs = new Map<string, Set<string>>();
  for (const { pack } of installed) {
    packWorks.set(pack.work.id, pack.work);
    if (pack.edition.kind === 'source') {
      const ids = sourceParagraphs.get(pack.work.id) ?? new Set<string>();
      for (const paragraph of pack.paragraphs) ids.add(paragraph.id);
      sourceParagraphs.set(pack.work.id, ids);
    }
  }
  for (const work of catalogue.works) {
    const packWork = packWorks.get(work.workId);
    if (!packWork) {
      throw new UsageError(`work ${work.slug} (${work.workId}) has no installed pack`);
    }
    if (packWork.slug !== work.slug) {
      throw new UsageError(
        `work ${work.workId} is "${work.slug}" in the catalogue and "${packWork.slug}" in its pack`,
      );
    }
    for (const entry of work.start) {
      if (!sourceParagraphs.get(work.workId)?.has(entry.paragraphId)) {
        throw new UsageError(
          `work ${work.slug}: the "where to start" paragraph ${entry.paragraphId} is not in its source edition`,
        );
      }
    }
  }
  const listed = new Set(catalogue.works.map((work) => work.workId));
  const unlisted = [...packWorks.values()]
    .filter((work) => !listed.has(work.id))
    .map((work) => ({ workId: work.id, slug: work.slug }));
  return { catalogue, unlisted };
}

export interface SignCatalogueInput {
  catalogue: Catalogue;
  secretKey: Uint8Array;
  signingKeyId: string;
  version: string;
  revision: number;
  createdAt: string;
  minAppVersion: string;
}

export interface SignedCatalogue {
  /** Exact bytes of catalogue.json: the canonical JSON of the catalogue. */
  catalogueBytes: Uint8Array;
  manifest: CatalogueManifest;
}

/** The manifest of a catalogue file, without its signature. */
function unsignedManifest(
  catalogueBytes: Uint8Array,
  input: Pick<
    SignCatalogueInput,
    'signingKeyId' | 'version' | 'revision' | 'createdAt' | 'minAppVersion'
  >,
): Omit<CatalogueManifest, 'signature'> {
  return {
    kind: 'catalogue',
    revision: input.revision,
    version: input.version,
    createdAt: input.createdAt,
    sha256: sha256Hex(catalogueBytes),
    size: catalogueBytes.length,
    minAppVersion: input.minAppVersion,
    signingKeyId: input.signingKeyId,
  };
}

/** Serialises the catalogue canonically, hashes it and signs the manifest. */
export function signCatalogue(input: SignCatalogueInput): SignedCatalogue {
  const catalogue = CatalogueSchema.parse(input.catalogue);
  const catalogueBytes = canonicalJsonBytes(catalogue);
  const unsigned = unsignedManifest(catalogueBytes, input);
  const payload = catalogueSigningPayload({ ...unsigned, signature: 'AA==' });
  const signature = toBase64(ed.sign(payload, input.secretKey));
  return { catalogueBytes, manifest: CatalogueManifestSchema.parse({ ...unsigned, signature }) };
}

export type VerifyCatalogueFailure =
  | 'manifest-invalid'
  | 'size-mismatch'
  | 'sha256-mismatch'
  | 'catalogue-invalid'
  | 'not-canonical'
  | 'unknown-key'
  | 'bad-signature'
  | 'app-too-old';

export type VerifyCatalogueResult =
  | { ok: true; manifest: CatalogueManifest; catalogue: Catalogue }
  | { ok: false; reason: VerifyCatalogueFailure; detail?: string };

export interface VerifyCatalogueInput {
  /** Exact bytes of catalogue.json. */
  catalogueBytes: Uint8Array;
  /** Parsed manifest.json (untrusted). */
  manifest: unknown;
  trustedKeys: readonly TrustedKey[];
  appVersion?: string;
}

/** Byte-exact verification of a catalogue file pair (used by the command and by its tests). */
export function verifyCatalogueBytes(input: VerifyCatalogueInput): VerifyCatalogueResult {
  const parsedManifest = CatalogueManifestSchema.safeParse(input.manifest);
  if (!parsedManifest.success) {
    return { ok: false, reason: 'manifest-invalid', detail: parsedManifest.error.message };
  }
  const manifest = parsedManifest.data;
  if (input.catalogueBytes.length !== manifest.size) {
    return {
      ok: false,
      reason: 'size-mismatch',
      detail: `${input.catalogueBytes.length} bytes, manifest says ${manifest.size}`,
    };
  }
  if (sha256Hex(input.catalogueBytes) !== manifest.sha256) {
    return { ok: false, reason: 'sha256-mismatch' };
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.catalogueBytes));
  } catch (error) {
    return { ok: false, reason: 'catalogue-invalid', detail: String(error) };
  }
  const parsed = CatalogueSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: 'catalogue-invalid', detail: parsed.error.message };
  }
  // The app recomputes the hash from the parsed object, so the file must be canonical.
  if (canonicalJson(json) !== new TextDecoder().decode(input.catalogueBytes)) {
    return { ok: false, reason: 'not-canonical' };
  }
  const key = input.trustedKeys.find((candidate) => candidate.id === manifest.signingKeyId);
  if (!key) return { ok: false, reason: 'unknown-key', detail: manifest.signingKeyId };
  let valid = false;
  try {
    valid = ed.verify(
      fromBase64(manifest.signature),
      catalogueSigningPayload(manifest),
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
  return { ok: true, manifest, catalogue: parsed.data };
}
