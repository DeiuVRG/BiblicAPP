import type { Pack, PackManifest, Paragraph, Section, Work } from '@biblioteca/shared';

import { checkPackBytes, vouchForPack } from '@/catalogue/catalogue-packs';
import type { CatalogueBackedPack } from '@/catalogue/catalogue-packs';
import { NO_CATALOGUE, loadBundledCatalogue } from '@/catalogue/verify-catalogue';
import type { CatalogueState } from '@/catalogue/verify-catalogue';
import { FALLBACK_LANGUAGE } from '@/i18n/language';
import type { ReadingLanguage } from '@/i18n/language';
import { foldText } from '@/search/fold';

import { getAppVersion } from './app-version';
import { bundledPacks } from './bundled-packs';
import type { BundledPack } from './bundled-packs';
import { orderEditions, pickPrimaryEdition } from './editions';
import { trustedKeys as defaultTrustedKeys } from './trusted-keys';
import type {
  EditionDetail,
  EditionSummary,
  SearchHit,
  SectionLocation,
  WorkDetail,
  WorkSummary,
} from './types';
import { verifyPack } from './verify-pack';
import type { TrustedKey, VerifyFailureReason } from './verify-pack';

export interface ContentRepository {
  /**
   * One entry per work, with all its installed editions. `readingLanguage` decides which edition
   * is the primary one of each work (see `pickPrimaryEdition`).
   */
  listWorks(readingLanguage?: ReadingLanguage): Promise<WorkSummary[]>;
  getWork(workId: string, readingLanguage?: ReadingLanguage): Promise<WorkDetail | null>;
  getEdition(editionId: string): Promise<EditionDetail | null>;
  /** Sections of one edition, ordered by ordinal. */
  getSections(editionId: string): Promise<Section[]>;
  /** Paragraphs of a section, ordered by ordinal. */
  getParagraphs(sectionId: string): Promise<Paragraph[]>;
  /** The work and the edition a section belongs to (a section id identifies its edition). */
  locateSection(sectionId: string): Promise<SectionLocation | null>;
  /** Local full-text search across installed packs (case and diacritics insensitive). */
  search(query: string): Promise<SearchHit[]>;
  /**
   * Local full-text search inside one edition (case and diacritics insensitive), in reading order:
   * at most `limit` hits (50 by default). The folded text of an edition is built once, when it is
   * first searched, and kept, so that a search is a scan over strings that are already folded.
   * An unknown or refused edition has no hits. Find in text (the reader) and Search "Pasaje" (an
   * edition at a time, so that the first edition cannot fill the cap for the others) use it;
   * `search` is the same scan over every edition.
   */
  searchEdition(
    editionId: string,
    query: string,
    options?: { limit?: number },
  ): Promise<SearchHit[]>;
  /**
   * The packs that were refused after the start, when their edition was first opened or searched:
   * the pack bytes were not the ones the signed catalogue lists. They are gone from the lists
   * from then on (`listWorks`, `getWork`), and the library says so.
   */
  refusedPacks(): readonly RejectedPack[];
}

export interface RejectedPack {
  packId: string | null;
  reason: VerifyFailureReason;
  detail?: string;
}

export interface LoadedRepository {
  repository: ContentRepository;
  /** Packs that failed verification. They are never exposed through the repository. */
  rejected: RejectedPack[];
  /**
   * The signed catalogue as it was verified at start, which is the source of the shelves, the
   * authors and the blurbs of the library (and of the pack hashes the repository checks lazily).
   */
  catalogue: CatalogueState;
}

export interface LoadOptions {
  packs?: readonly BundledPack[];
  trustedKeys?: readonly TrustedKey[];
  appVersion?: string;
  /** Injectable for tests. */
  verify?: typeof verifyPack;
  /**
   * The catalogue to trust (the result of `loadBundledCatalogue`). A pack that a verified
   * catalogue lists is admitted without its own signature check and its hash is checked when its
   * edition is first opened or searched; every other pack is verified in full at start, as before.
   * Without it, or when it was rejected, every pack is verified in full.
   */
  catalogue?: CatalogueState;
}

const MAX_SEARCH_HITS = 50;

const SNIPPET_BEFORE = 50;
const SNIPPET_LENGTH = 160;

/** Short excerpt around a match, snapped to word boundaries and marked with ellipses. */
function makeSnippet(text: string, matchIndex: number): string {
  let start = Math.max(0, matchIndex - SNIPPET_BEFORE);
  let end = Math.min(text.length, start + SNIPPET_LENGTH);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space >= 0 && space < matchIndex) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > matchIndex) end = space;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function byOrdinal<T extends { ordinal: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.ordinal - b.ordinal);
}

/**
 * A pack that passed `verifyPack` (schemas, sha256 and Ed25519 signature against the pinned
 * keys). `signatureVerified: true` is part of the type on purpose: there is no way to hand the
 * repository a pack that was not signature-verified without lying to the compiler, and the
 * repository re-checks it at runtime.
 */
export interface VerifiedPack {
  manifest: PackManifest;
  pack: Pack;
  signatureVerified: true;
}

/** A pack the repository may serve: verified in full, or vouched for by the signed catalogue. */
export type AdmittedPack = VerifiedPack | CatalogueBackedPack;

/** Thrown when the repository is asked to serve a pack that was not signature-verified. */
export class UnverifiedPackError extends Error {
  constructor(packId: string | undefined) {
    super(`Refusing to serve an unverified content pack${packId ? ` (${packId})` : ''}`);
    this.name = 'UnverifiedPackError';
  }
}

/**
 * Puts verified packs side by side. The first pack that claims an id keeps it; a later pack that
 * would share an edition id (`duplicate-edition`) or a section or paragraph id (`duplicate-id`)
 * with an accepted one is rejected as a whole, like a pack with a bad signature. Two packs of one
 * work are fine: they are two editions of it. Ids are compared within their kind (a section id
 * against section ids, a paragraph id against paragraph ids), which is what lookups need.
 */
export function admitPacks<T extends { manifest: PackManifest; pack: Pack }>(
  packs: readonly T[],
): {
  accepted: T[];
  rejected: RejectedPack[];
} {
  const accepted: T[] = [];
  const rejected: RejectedPack[] = [];
  const editionIds = new Set<string>();
  const sectionIds = new Set<string>();
  const paragraphIds = new Set<string>();
  for (const entry of packs) {
    const { pack } = entry;
    const packId = entry.manifest.packId;
    if (editionIds.has(pack.edition.id)) {
      rejected.push({ packId, reason: 'duplicate-edition' });
      continue;
    }
    const clashes =
      pack.sections.some((section) => sectionIds.has(section.id)) ||
      pack.paragraphs.some((paragraph) => paragraphIds.has(paragraph.id));
    if (clashes) {
      rejected.push({ packId, reason: 'duplicate-id' });
      continue;
    }
    editionIds.add(pack.edition.id);
    for (const section of pack.sections) sectionIds.add(section.id);
    for (const paragraph of pack.paragraphs) paragraphIds.add(paragraph.id);
    accepted.push(entry);
  }
  return { accepted, rejected };
}

function summarize(entry: AdmittedPack): EditionSummary {
  const { pack, manifest } = entry;
  return {
    editionId: pack.edition.id,
    packId: manifest.packId,
    language: pack.edition.language,
    kind: pack.edition.kind,
    licenceStatus: pack.edition.licence.status,
    licenceNote: pack.edition.licence.note,
    ...(pack.edition.sourceEditionId === undefined
      ? null
      : { sourceEditionId: pack.edition.sourceEditionId }),
    sectionCount: pack.sections.length,
  };
}

/**
 * The metadata of a work seen through all its packs: the source edition's copy when it is
 * installed (the first pack otherwise), plus the English title if only a translation carries it.
 */
function mergeWork(packs: readonly Pack[]): Work | undefined {
  const base = (packs.find((pack) => pack.edition.kind === 'source') ?? packs[0])?.work;
  if (!base || base.titleEn !== undefined) return base;
  const titleEn = packs.find((pack) => pack.work.titleEn !== undefined)?.work.titleEn;
  return titleEn === undefined ? base : { ...base, titleEn };
}

interface EditionRecord {
  entry: AdmittedPack;
  summary: EditionSummary;
  sections: Section[];
  /**
   * `verified`: checked in full. `pending`: the signed catalogue vouches for it and its bytes are
   * checked when it is first opened. `refused`: those bytes were not the ones the catalogue lists.
   */
  state: 'verified' | 'pending' | 'refused';
  /** The one check of a pending edition, shared by everyone who waits for it. */
  check?: Promise<boolean>;
}

function isAdmissible(entry: AdmittedPack): boolean {
  const flags = entry as { signatureVerified?: unknown; catalogueVerified?: unknown };
  return flags.signatureVerified === true || flags.catalogueVerified === true;
}

/** A paragraph with its folded text and the heading of its section, ready to be scanned. */
interface FoldedParagraph {
  paragraph: Paragraph;
  heading: string;
  folded: string;
}

interface WorkRecord {
  work: Work;
  /** In display order. */
  editions: EditionSummary[];
}

/**
 * In-memory repository over admitted packs: those verified in full, and those that a verified
 * catalogue vouches for, whose bytes are checked against the catalogue when their edition is first
 * opened or searched (`listWorks` and `getWork` only read the metadata and never wait for it).
 */
export function createInMemoryRepository(
  verifiedPacks: readonly AdmittedPack[],
): ContentRepository {
  for (const entry of verifiedPacks) {
    if (!isAdmissible(entry)) throw new UnverifiedPackError(entry.manifest?.packId);
  }
  // A clash between packs is reported by `loadBundledRepository`; here the later pack is skipped.
  const { accepted } = admitPacks(verifiedPacks);

  const editionRecords = new Map<string, EditionRecord>();
  const sectionOwner = new Map<string, EditionRecord>();
  const paragraphsBySection = new Map<string, Paragraph[]>();
  const summariesByWork = new Map<string, EditionSummary[]>();
  const packsByWork = new Map<string, Pack[]>();
  for (const entry of accepted) {
    const { pack } = entry;
    const record: EditionRecord = {
      entry,
      summary: summarize(entry),
      sections: byOrdinal(pack.sections),
      state: (entry as { signatureVerified?: unknown }).signatureVerified === true ? 'verified' : 'pending',
    };
    editionRecords.set(pack.edition.id, record);
    for (const section of pack.sections) sectionOwner.set(section.id, record);
    for (const paragraph of pack.paragraphs) {
      const list = paragraphsBySection.get(paragraph.sectionId) ?? [];
      list.push(paragraph);
      paragraphsBySection.set(paragraph.sectionId, list);
    }
    summariesByWork.set(pack.work.id, [
      ...(summariesByWork.get(pack.work.id) ?? []),
      record.summary,
    ]);
    packsByWork.set(pack.work.id, [...(packsByWork.get(pack.work.id) ?? []), pack]);
  }

  // Works in the order their first pack was installed.
  const works = new Map<string, WorkRecord>();
  for (const [workId, summaries] of summariesByWork) {
    const work = mergeWork(packsByWork.get(workId) ?? []);
    if (work) works.set(workId, { work, editions: orderEditions(summaries) });
  }

  const refused: RejectedPack[] = [];

  // The folded text of an edition's paragraphs in reading order, built on its first search.
  const foldedByEdition = new Map<string, FoldedParagraph[]>();
  const foldedOf = (record: EditionRecord): FoldedParagraph[] => {
    const editionId = record.summary.editionId;
    let list = foldedByEdition.get(editionId);
    if (!list) {
      list = record.sections.flatMap((section) =>
        byOrdinal(paragraphsBySection.get(section.id) ?? []).map((paragraph) => ({
          paragraph,
          heading: section.heading,
          folded: foldText(paragraph.text),
        })),
      );
      foldedByEdition.set(editionId, list);
    }
    return list;
  };

  /** The hits of an edition that is fit to serve, in reading order, at most `limit`. */
  const scan = (record: EditionRecord, needle: string, limit: number): SearchHit[] => {
    const hits: SearchHit[] = [];
    if (limit <= 0) return hits;
    for (const { paragraph, heading, folded } of foldedOf(record)) {
      const index = folded.indexOf(needle);
      if (index < 0) continue;
      hits.push({
        workId: record.entry.pack.work.id,
        editionId: record.summary.editionId,
        language: record.summary.language,
        sectionId: paragraph.sectionId,
        paragraphId: paragraph.id,
        sectionHeading: heading,
        snippet: makeSnippet(paragraph.text, index),
      });
      if (hits.length >= limit) break;
    }
    return hits;
  };

  /** Takes a pack that failed its check out of every list. */
  const refuse = (record: EditionRecord, reason: NonNullable<ReturnType<typeof checkPackBytes>>) => {
    record.state = 'refused';
    refused.push({
      packId: record.summary.packId,
      reason,
      detail: 'the pack is not the one the signed catalogue lists',
    });
    const work = works.get(record.entry.pack.work.id);
    if (work) {
      work.editions = work.editions.filter((edition) => edition.editionId !== record.summary.editionId);
      if (work.editions.length === 0) works.delete(record.entry.pack.work.id);
    }
  };

  /**
   * The edition, once it is fit to serve: a pending one has its bytes checked first (once; callers
   * share the check). Null for an unknown or refused edition.
   */
  const open = async (editionId: string): Promise<EditionRecord | null> => {
    const record = editionRecords.get(editionId);
    if (!record || record.state === 'refused') return null;
    if (record.state === 'verified') return record;
    record.check ??= Promise.resolve().then(() => {
      const reason = checkPackBytes(record.entry as CatalogueBackedPack);
      if (reason === null) {
        if (record.state === 'pending') record.state = 'verified';
        return true;
      }
      refuse(record, reason);
      return false;
    });
    return (await record.check) ? record : null;
  };

  const summaryOf = (record: WorkRecord, readingLanguage: ReadingLanguage): WorkSummary | null => {
    const primary = pickPrimaryEdition(record.editions, readingLanguage);
    if (!primary) return null;
    const { work } = record;
    return {
      workId: work.id,
      slug: work.slug,
      titleRo: work.titleRo,
      ...(work.titleEn === undefined ? null : { titleEn: work.titleEn }),
      titleOrig: work.titleOrig,
      authorName: work.author.name,
      authorBorn: work.author.born,
      authorDied: work.author.died,
      year: work.year,
      languageOrig: work.languageOrig,
      editions: [...record.editions],
      primaryEditionId: primary.editionId,
    };
  };

  return {
    async listWorks(readingLanguage = FALLBACK_LANGUAGE) {
      return [...works.values()].flatMap((record) => {
        const summary = summaryOf(record, readingLanguage);
        return summary ? [summary] : [];
      });
    },

    async getWork(workId, readingLanguage = FALLBACK_LANGUAGE) {
      const record = works.get(workId);
      const summary = record ? summaryOf(record, readingLanguage) : null;
      if (!record || !summary) return null;
      return {
        work: record.work,
        editions: summary.editions,
        primaryEditionId: summary.primaryEditionId,
      };
    },

    async getEdition(editionId) {
      const record = await open(editionId);
      if (!record) return null;
      const { pack } = record.entry;
      return {
        ...record.summary,
        work: works.get(pack.work.id)?.work ?? pack.work,
        edition: pack.edition,
      };
    },

    async getSections(editionId) {
      const record = await open(editionId);
      return [...(record?.sections ?? [])];
    },

    async getParagraphs(sectionId) {
      const owner = sectionOwner.get(sectionId);
      if (!owner || !(await open(owner.summary.editionId))) return [];
      return byOrdinal(paragraphsBySection.get(sectionId) ?? []);
    },

    async locateSection(sectionId) {
      const owner = sectionOwner.get(sectionId);
      if (!owner || !(await open(owner.summary.editionId))) return null;
      return {
        workId: owner.entry.pack.work.id,
        editionId: owner.summary.editionId,
        language: owner.summary.language,
      };
    },

    async search(query) {
      const needle = foldText(query.trim());
      if (needle.length < 2) return [];
      const hits: SearchHit[] = [];
      for (const { pack } of accepted) {
        // A search reads every edition: the ones not yet checked are checked now (once).
        const record = await open(pack.edition.id);
        if (!record) continue;
        hits.push(...scan(record, needle, MAX_SEARCH_HITS - hits.length));
        if (hits.length >= MAX_SEARCH_HITS) return hits;
      }
      return hits;
    },

    async searchEdition(editionId, query, options = {}) {
      const needle = foldText(query.trim());
      if (needle.length < 2) return [];
      const record = await open(editionId);
      return record ? scan(record, needle, options.limit ?? MAX_SEARCH_HITS) : [];
    },

    refusedPacks() {
      return [...refused];
    },
  };
}

/**
 * Builds a repository from the bundled packs. A pack that the verified catalogue lists is admitted
 * after the cheap checks (schemas, identity, the catalogue's entry) and its bytes are checked when
 * its edition is first opened; every other pack is verified in full here (schemas, sha256, Ed25519
 * signature against the pinned keys). A pack that fails, or that clashes with an earlier one (same
 * edition, or ids already taken), is rejected.
 */
export async function loadBundledRepository(options: LoadOptions = {}): Promise<LoadedRepository> {
  const verify = options.verify ?? verifyPack;
  const catalogue = options.catalogue ?? NO_CATALOGUE;
  const listed =
    catalogue.status === 'verified'
      ? new Map(catalogue.catalogue.packs.map((entry) => [entry.packId, entry]))
      : null;
  const appVersion = options.appVersion ?? getAppVersion();
  const verified: AdmittedPack[] = [];
  const rejected: RejectedPack[] = [];
  for (const bundled of options.packs ?? bundledPacks) {
    const packId = (bundled.manifest as { packId?: string } | null | undefined)?.packId;
    const expected = packId === undefined ? undefined : listed?.get(packId);
    if (expected) {
      const vouched = vouchForPack({
        manifest: bundled.manifest,
        pack: bundled.pack,
        expected,
        appVersion,
      });
      if (vouched.ok) verified.push(vouched.entry);
      else rejected.push({ packId: packId ?? null, reason: vouched.reason, detail: vouched.detail });
      continue;
    }
    const result = await verify({
      manifest: bundled.manifest,
      pack: bundled.pack,
      trustedKeys: options.trustedKeys ?? defaultTrustedKeys,
      appVersion,
    });
    if (result.ok && result.signatureVerified === true) {
      verified.push({ manifest: result.manifest, pack: result.pack, signatureVerified: true });
    } else if (result.ok) {
      // A verifier that accepts without having checked the signature is not good enough.
      rejected.push({ packId: result.manifest.packId, reason: 'unverified' });
    } else {
      rejected.push({ packId: packId ?? null, reason: result.reason, detail: result.detail });
    }
  }
  const admitted = admitPacks(verified);
  rejected.push(...admitted.rejected);
  return { repository: createInMemoryRepository(admitted.accepted), rejected, catalogue };
}

let cached: Promise<LoadedRepository> | undefined;

/**
 * Lazily loads (and memoises) the repository over the bundled packs, with the bundled catalogue
 * verified once (its signature is the only check of the start for the packs it lists). A failed
 * load is not cached: the next call retries.
 */
export function getRepository(): Promise<LoadedRepository> {
  if (!cached) {
    const attempt = loadBundledCatalogue().then((catalogue) => loadBundledRepository({ catalogue }));
    cached = attempt;
    attempt.catch(() => {
      if (cached === attempt) cached = undefined;
    });
  }
  return cached;
}
