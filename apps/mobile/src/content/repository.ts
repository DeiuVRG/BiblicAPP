import type { Pack, PackManifest, Paragraph, Section, Work } from '@biblioteca/shared';

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
}

export interface LoadOptions {
  packs?: readonly BundledPack[];
  trustedKeys?: readonly TrustedKey[];
  appVersion?: string;
  /** Injectable for tests. */
  verify?: typeof verifyPack;
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
export function admitPacks(packs: readonly VerifiedPack[]): {
  accepted: VerifiedPack[];
  rejected: RejectedPack[];
} {
  const accepted: VerifiedPack[] = [];
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

function summarize(entry: VerifiedPack): EditionSummary {
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
  entry: VerifiedPack;
  summary: EditionSummary;
  sections: Section[];
}

interface WorkRecord {
  work: Work;
  /** In display order. */
  editions: EditionSummary[];
}

/** In-memory repository over already verified packs. */
export function createInMemoryRepository(
  verifiedPacks: readonly VerifiedPack[],
): ContentRepository {
  for (const entry of verifiedPacks) {
    if ((entry as { signatureVerified?: unknown }).signatureVerified !== true) {
      throw new UnverifiedPackError(entry.manifest?.packId);
    }
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
      const record = editionRecords.get(editionId);
      if (!record) return null;
      const { pack } = record.entry;
      return {
        ...record.summary,
        work: works.get(pack.work.id)?.work ?? pack.work,
        edition: pack.edition,
      };
    },

    async getSections(editionId) {
      return [...(editionRecords.get(editionId)?.sections ?? [])];
    },

    async getParagraphs(sectionId) {
      return byOrdinal(paragraphsBySection.get(sectionId) ?? []);
    },

    async locateSection(sectionId) {
      const owner = sectionOwner.get(sectionId);
      if (!owner) return null;
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
        const headings = new Map(pack.sections.map((s) => [s.id, s.heading]));
        for (const paragraph of pack.paragraphs) {
          const haystack = foldText(paragraph.text);
          const index = haystack.indexOf(needle);
          if (index < 0) continue;
          hits.push({
            workId: pack.work.id,
            editionId: pack.edition.id,
            language: pack.edition.language,
            sectionId: paragraph.sectionId,
            paragraphId: paragraph.id,
            sectionHeading: headings.get(paragraph.sectionId) ?? '',
            snippet: makeSnippet(paragraph.text, index),
          });
          if (hits.length >= MAX_SEARCH_HITS) return hits;
        }
      }
      return hits;
    },
  };
}

/**
 * Verifies every bundled pack and builds a repository from those that pass. A pack that clashes
 * with an earlier one (same edition, or ids already taken) is rejected too.
 */
export async function loadBundledRepository(options: LoadOptions = {}): Promise<LoadedRepository> {
  const verify = options.verify ?? verifyPack;
  const verified: VerifiedPack[] = [];
  const rejected: RejectedPack[] = [];
  for (const bundled of options.packs ?? bundledPacks) {
    const result = await verify({
      manifest: bundled.manifest,
      pack: bundled.pack,
      trustedKeys: options.trustedKeys ?? defaultTrustedKeys,
      appVersion: options.appVersion ?? getAppVersion(),
    });
    if (result.ok && result.signatureVerified === true) {
      verified.push({ manifest: result.manifest, pack: result.pack, signatureVerified: true });
    } else if (result.ok) {
      // A verifier that accepts without having checked the signature is not good enough.
      rejected.push({ packId: result.manifest.packId, reason: 'unverified' });
    } else {
      const packId = (bundled.manifest as { packId?: string } | null | undefined)?.packId ?? null;
      rejected.push({ packId, reason: result.reason, detail: result.detail });
    }
  }
  const admitted = admitPacks(verified);
  rejected.push(...admitted.rejected);
  return { repository: createInMemoryRepository(admitted.accepted), rejected };
}

let cached: Promise<LoadedRepository> | undefined;

/**
 * Lazily loads (and memoises) the repository over the bundled packs. A failed load is not
 * cached: the next call retries.
 */
export function getRepository(): Promise<LoadedRepository> {
  if (!cached) {
    const attempt = loadBundledRepository();
    cached = attempt;
    attempt.catch(() => {
      if (cached === attempt) cached = undefined;
    });
  }
  return cached;
}
