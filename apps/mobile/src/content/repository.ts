import type { Pack, PackManifest, Paragraph, Section } from '@biblioteca/shared';

import { bundledPacks } from './bundled-packs';
import type { BundledPack } from './bundled-packs';
import { trustedKeys as defaultTrustedKeys } from './trusted-keys';
import type { SearchHit, WorkDetail, WorkSummary } from './types';
import { verifyPack } from './verify-pack';
import type { TrustedKey, VerifyFailureReason } from './verify-pack';

export interface ContentRepository {
  listWorks(): Promise<WorkSummary[]>;
  getWork(workId: string): Promise<WorkDetail | null>;
  /** Sections of a work, ordered by ordinal. */
  getSections(workId: string): Promise<Section[]>;
  /** Paragraphs of a section, ordered by ordinal. */
  getParagraphs(sectionId: string): Promise<Paragraph[]>;
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

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function byOrdinal<T extends { ordinal: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.ordinal - b.ordinal);
}

export interface VerifiedPack {
  manifest: PackManifest;
  pack: Pack;
}

/** In-memory repository over already verified packs. */
export function createInMemoryRepository(verifiedPacks: readonly VerifiedPack[]): ContentRepository {
  const packs = verifiedPacks.map((entry) => entry.pack);
  const packIds = new Map(verifiedPacks.map((entry) => [entry.pack.work.id, entry.manifest.packId]));
  const byWork = new Map<string, Pack>();
  const sectionToPack = new Map<string, Pack>();
  const paragraphsBySection = new Map<string, Paragraph[]>();
  for (const pack of packs) {
    byWork.set(pack.work.id, pack);
    for (const section of pack.sections) sectionToPack.set(section.id, pack);
    for (const paragraph of pack.paragraphs) {
      const list = paragraphsBySection.get(paragraph.sectionId) ?? [];
      list.push(paragraph);
      paragraphsBySection.set(paragraph.sectionId, list);
    }
  }

  return {
    async listWorks() {
      return packs.map((pack) => ({
        workId: pack.work.id,
        slug: pack.work.slug,
        titleRo: pack.work.titleRo,
        titleOrig: pack.work.titleOrig,
        authorName: pack.work.author.name,
        year: pack.work.year,
        languageOrig: pack.work.languageOrig,
        editionId: pack.edition.id,
        editionLanguage: pack.edition.language,
        licenceStatus: pack.edition.licence.status,
      }));
    },

    async getWork(workId) {
      const pack = byWork.get(workId);
      if (!pack) return null;
      return {
        work: pack.work,
        edition: pack.edition,
        packId: packIds.get(workId) ?? '',
        sectionCount: pack.sections.length,
      };
    },

    async getSections(workId) {
      return byOrdinal(byWork.get(workId)?.sections ?? []);
    },

    async getParagraphs(sectionId) {
      return byOrdinal(paragraphsBySection.get(sectionId) ?? []);
    },

    async search(query) {
      const needle = normalise(query.trim());
      if (needle.length < 2) return [];
      const hits: SearchHit[] = [];
      for (const pack of packs) {
        const headings = new Map(pack.sections.map((s) => [s.id, s.heading]));
        for (const paragraph of pack.paragraphs) {
          const haystack = normalise(paragraph.text);
          const index = haystack.indexOf(needle);
          if (index < 0) continue;
          // normalise() can change string length only for exotic characters; clamp defensively.
          const start = Math.max(0, index - 40);
          hits.push({
            workId: pack.work.id,
            sectionId: paragraph.sectionId,
            paragraphId: paragraph.id,
            sectionHeading: headings.get(paragraph.sectionId) ?? '',
            snippet: paragraph.text.slice(start, start + 140),
          });
          if (hits.length >= MAX_SEARCH_HITS) return hits;
        }
      }
      return hits;
    },
  };
}

/** Verifies every bundled pack and builds a repository from those that pass. */
export async function loadBundledRepository(options: LoadOptions = {}): Promise<LoadedRepository> {
  const verify = options.verify ?? verifyPack;
  const verified: VerifiedPack[] = [];
  const rejected: RejectedPack[] = [];
  for (const bundled of options.packs ?? bundledPacks) {
    const result = await verify({
      manifest: bundled.manifest,
      pack: bundled.pack,
      trustedKeys: options.trustedKeys ?? defaultTrustedKeys,
      appVersion: options.appVersion,
    });
    if (result.ok) {
      verified.push({ manifest: result.manifest, pack: result.pack });
    } else {
      const packId =
        (bundled.manifest as { packId?: string } | null | undefined)?.packId ?? null;
      rejected.push({ packId, reason: result.reason, detail: result.detail });
    }
  }
  return { repository: createInMemoryRepository(verified), rejected };
}

let cached: Promise<LoadedRepository> | undefined;

/** Lazily loads (and memoises) the repository over the bundled packs. */
export function getRepository(): Promise<LoadedRepository> {
  cached ??= loadBundledRepository();
  return cached;
}
