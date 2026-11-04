import { canonicalJsonBytes, manifestSigningPayload } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';
import type { Pack, PackManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { bundledPacks } from '@/content/bundled-packs';
import type { BundledPack } from '@/content/bundled-packs';
import type { TrustedKey } from '@/content/verify-pack';

ed.hashes.sha512 = sha512;

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** A throwaway Ed25519 key: its public half is trusted by a test, its secret half signs packs. */
export interface TestSigner {
  key: TrustedKey;
  secretKey: Uint8Array;
}

export function createTestSigner(id = 'test-key-1'): TestSigner {
  const secretKey = ed.utils.randomSecretKey();
  return { key: { id, publicKey: toBase64(ed.getPublicKey(secretKey)) }, secretKey };
}

/** Signs a pack the way the content tools do: sha256 of its canonical JSON, Ed25519 over the manifest. */
export function signPack(
  pack: Pack,
  signer: TestSigner,
  options: { packId: string; revision?: number; minAppVersion?: string },
): BundledPack {
  const bytes = canonicalJsonBytes(pack);
  const manifest: PackManifest = {
    packId: options.packId,
    kind: 'edition',
    workId: pack.work.id,
    editionId: pack.edition.id,
    revision: options.revision ?? 1,
    version: '1.0.0',
    createdAt: '2026-11-04T00:00:00.000Z',
    sha256: bytesToHex(sha256(bytes)),
    size: bytes.length,
    minAppVersion: options.minAppVersion ?? '0.1.0',
    signingKeyId: signer.key.id,
    signature: 'AA==',
  };
  manifest.signature = toBase64(ed.sign(manifestSigningPayload(manifest), signer.secretKey));
  return { manifest, pack };
}

/** The bundled pack with this pack id (for example `vos-1903-kingdom-en`). */
export function bundledPack(packId: string): BundledPack {
  const found = bundledPacks.find(
    (candidate) => (candidate.manifest as { packId?: string }).packId === packId,
  );
  if (!found) throw new Error(`no bundled pack ${packId}`);
  return found;
}

/** A deep copy that tests may change. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * A deep copy of `pack` without the optional display metadata the real packs now carry: the
 * work's `titleEn` and the edition licence's `noteRo`/`noteEn`. For scenarios that need a source
 * pack which does not have them (the fallbacks to `titleOrig` and to the English `note`).
 */
export function barePack(pack: Pack): Pack {
  const bare = clone(pack);
  delete bare.work.titleEn;
  delete bare.edition.licence.noteRo;
  delete bare.edition.licence.noteEn;
  return bare;
}

/** `barePack` of the bundled English Vos edition, signed with the test key (trust `signer.key`). */
export function bareEnglishPack(signer: TestSigner, packId = 'vos-bare-en'): BundledPack {
  return signPack(barePack(bundledPack('vos-1903-kingdom-en').pack as Pack), signer, { packId });
}

export interface TranslationOptions {
  language?: string;
  /** How many of the source's sections the translation covers (it is partial when fewer). */
  sections?: number;
  paragraphsPerSection?: number;
  editionId?: string;
  /** Adds `titleEn` to the work (a translation into English carries it). */
  titleEn?: string;
}

/**
 * A synthetic translation of the first sections of `source`, aligned to it paragraph by
 * paragraph (`sourceId`), with ids of its own. The text is made up: "Text sintetic ... " plus the
 * kingdom of God in Romanian, so that searches can tell the two editions apart.
 */
export function translationOf(source: Pack, options: TranslationOptions = {}): Pack {
  const { language = 'ro', sections = 3, paragraphsPerSection = 2 } = options;
  const picked = [...source.sections].sort((a, b) => a.ordinal - b.ordinal).slice(0, sections);
  const sectionIds = new Map(picked.map((section) => [section.id, stableId()]));
  const translatedSections = picked.map((section, index) => ({
    id: sectionIds.get(section.id) ?? stableId(),
    ordinal: index,
    kind: section.kind,
    heading: `${index + 1}. Capitol sintetic ${index + 1}`,
    sourceId: section.id,
  }));
  const translatedParagraphs = picked.flatMap((section, index) =>
    source.paragraphs
      .filter((paragraph) => paragraph.sectionId === section.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .slice(0, paragraphsPerSection)
      .map((paragraph, ordinal) => ({
        id: stableId(),
        sectionId: sectionIds.get(section.id) ?? '',
        ordinal,
        kind: 'p' as const,
        text: `Text sintetic ${index + 1}.${ordinal + 1}. Împărăția lui Dumnezeu este aproape.`,
        sourceId: paragraph.id,
      })),
  );
  return {
    work: options.titleEn ? { ...source.work, titleEn: options.titleEn } : source.work,
    edition: {
      id: options.editionId ?? stableId(),
      language,
      kind: 'translation',
      licence: {
        status: 'licensed',
        note: 'Synthetic translation made for tests.',
        noteRo: 'Traducere sintetică făcută pentru teste.',
        noteEn: 'Synthetic translation made for tests (English note).',
      },
      provenance: { source: 'test fixture', extractedBy: 'test fixture', notes: '' },
      sourceEditionId: source.edition.id,
    },
    sections: translatedSections,
    paragraphs: translatedParagraphs,
  };
}
