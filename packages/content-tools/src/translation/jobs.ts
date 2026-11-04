import fs from 'node:fs';
import path from 'node:path';

import type { Pack, Paragraph, Section } from '@biblioteca/shared';

import { UsageError } from '../lib/usage-error';
import { findUnparsedReferenceFragments, parseSourceReferences } from './references';
import type { JobIndex, TranslationJob } from './schemas';
import { countWords, escapeRegExp } from './text-utils';

export interface ChunkOptions {
  /** A part is closed as soon as it has this many words. */
  targetWords: number;
  /** A part never exceeds this, except a single paragraph that is longer on its own. */
  maxWords: number;
  /** A final part with fewer words is merged into the previous part when the sum fits. */
  minLastWords: number;
}

export const DEFAULT_CHUNK: ChunkOptions = { targetWords: 900, maxWords: 1500, minLastWords: 300 };

/** A range of 1-based chapter numbers (ordinal + 1), both ends included. */
export type SectionRange = readonly [from: number, to: number];

/**
 * Parses the syntax of `--sections` (`1,2,5-7`) into ranges, without expanding them. Malformed
 * lists are usage errors.
 */
export function parseSectionRanges(list: string): SectionRange[] {
  return list.split(',').map((raw): SectionRange => {
    const token = raw.trim();
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    const from = Number.parseInt(match?.[1] ?? '', 10);
    const to = match?.[2] === undefined ? from : Number.parseInt(match[2], 10);
    if (!match || from < 1 || to < from) {
      throw new UsageError(`--sections: cannot read "${token}" (expected e.g. 1,2,5-7)`);
    }
    return [from, to];
  });
}

/**
 * The chapter numbers of the ranges. A chapter beyond the `available` ones is a usage error that
 * is found from the ends of the ranges, before anything is expanded (`1-300000000` must not
 * allocate 300 million numbers).
 */
export function expandSections(ranges: readonly SectionRange[], available: number): Set<number> {
  const beyond = ranges
    .filter(([, to]) => to > available)
    .map(([from, to]) => {
      const first = Math.max(from, available + 1);
      return first === to ? String(to) : `${first}-${to}`;
    });
  if (beyond.length > 0) {
    throw new UsageError(
      `--sections: no chapter ${beyond.join(', ')} (the edition has ${available})`,
    );
  }
  const numbers = new Set<number>();
  for (const [from, to] of ranges) {
    for (let n = from; n <= to; n += 1) numbers.add(n);
  }
  return numbers;
}

/** `--sections` as the set of chapter numbers of an edition with `available` chapters. */
export function parseSectionList(list: string, available: number): Set<number> {
  return expandSections(parseSectionRanges(list), available);
}

/**
 * Splits the paragraphs of one section into consecutive parts. A paragraph is never split:
 * paragraphs are appended until the part reaches `targetWords`; a paragraph that would push a
 * part over `maxWords` starts the next one; a paragraph longer than `maxWords` is a part on its
 * own; a short final part is merged into its predecessor when the sum stays within
 * `maxWords + minLastWords`.
 */
export function splitIntoParts<T>(
  items: readonly T[],
  wordsOf: (item: T) => number,
  options: ChunkOptions,
): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let currentWords = 0;
  const close = (): void => {
    if (current.length > 0) parts.push(current);
    current = [];
    currentWords = 0;
  };
  for (const item of items) {
    const words = wordsOf(item);
    if (words > options.maxWords) {
      close();
      parts.push([item]);
      continue;
    }
    if (currentWords + words > options.maxWords) close();
    current.push(item);
    currentWords += words;
    if (currentWords >= options.targetWords) close();
  }
  close();

  const last = parts[parts.length - 1];
  const previous = parts[parts.length - 2];
  if (last && previous) {
    const lastWords = last.reduce((sum, item) => sum + wordsOf(item), 0);
    const previousWords = previous.reduce((sum, item) => sum + wordsOf(item), 0);
    if (
      lastWords < options.minLastWords &&
      previousWords + lastWords <= options.maxWords + options.minLastWords
    ) {
      previous.push(...last);
      parts.pop();
    }
  }
  return parts;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Job files of an earlier run that this run does not produce, for the given sections only:
 * `<slug>-<lang>-03-02.json` after chapter 3 was split into fewer parts. They are not in
 * `index.json` but overlap the new jobs, so a consumer that globs the directory would dispatch
 * the same paragraphs twice. Jobs of sections outside the run are left alone.
 */
export function staleJobFiles(
  jobsDir: string,
  slug: string,
  lang: string,
  sectionOrdinals: ReadonlySet<number>,
  produced: ReadonlySet<string>,
): string[] {
  if (!fs.existsSync(jobsDir)) return [];
  const pattern = new RegExp(`^${escapeRegExp(`${slug}-${lang}-`)}(\\d{2,})-\\d{2,}\\.json$`);
  return fs
    .readdirSync(jobsDir)
    .filter((name) => {
      const section = pattern.exec(name)?.[1];
      return (
        section !== undefined &&
        !produced.has(name) &&
        sectionOrdinals.has(Number.parseInt(section, 10) - 1)
      );
    })
    .sort();
}

/** `vos-1903-kingdom-ro-01-00`: section ordinal + 1, then the part index. */
export function jobIdFor(slug: string, lang: string, sectionOrdinal: number, part: number): string {
  return `${slug}-${lang}-${pad(sectionOrdinal + 1)}-${pad(part)}`;
}

export interface UnparsedInJob {
  jobId: string;
  sourceId: string;
  fragments: { index: number; text: string }[];
}

export interface BuildJobsOptions {
  edition: Pack;
  targetLanguage: string;
  chunk: ChunkOptions;
  /** 1-based chapter numbers to include; all sections when omitted. */
  sections?: ReadonlySet<number>;
  /** Directory in which `content/translation/...` is looked up (the repository root). */
  repoRoot: string;
  /** sha256 of the bytes of the source edition file, recorded in `index.json`. */
  sourceSha256: string;
}

export interface BuiltJobs {
  jobs: TranslationJob[];
  index: JobIndex;
  /** Number of reference runs found in the selected paragraphs. */
  referenceRuns: number;
  /** Reference-like fragments that did not parse (should be none). */
  unparsed: UnparsedInJob[];
  /** Sections without paragraphs (they produce no job). */
  emptySections: Section[];
}

function materialsFor(options: BuildJobsOptions): TranslationJob['materials'] {
  const { targetLanguage: lang, repoRoot } = options;
  const slug = options.edition.work.slug;
  const profileFile = path.join(repoRoot, 'content', 'translation', 'profiles', `${slug}.md`);
  return {
    rules: `content/translation/rules-${lang}.md`,
    contract: 'content/translation/output-contract.md',
    glossary: `content/translation/glossary-${lang}.csv`,
    calques: `content/translation/calques-${lang}.json`,
    profile: fs.existsSync(profileFile) ? `content/translation/profiles/${slug}.md` : null,
  };
}

/** Splits a source edition into translation jobs (docs/traducere-pipeline.md, section 3.1). */
export function buildJobs(options: BuildJobsOptions): BuiltJobs {
  const { edition, targetLanguage, chunk } = options;
  const slug = edition.work.slug;
  const sections = [...edition.sections].sort((a, b) => a.ordinal - b.ordinal);
  const bySection = new Map<string, Paragraph[]>();
  for (const paragraph of edition.paragraphs) {
    const list = bySection.get(paragraph.sectionId) ?? [];
    list.push(paragraph);
    bySection.set(paragraph.sectionId, list);
  }
  for (const list of bySection.values()) list.sort((a, b) => a.ordinal - b.ordinal);
  // The neighbours of a job come from the whole document in reading order, so that the first job
  // of a chapter sees the end of the previous chapter and the last one the start of the next,
  // whichever sections are selected.
  const inReadingOrder = sections.flatMap((section) => bySection.get(section.id) ?? []);
  const positionOf = new Map(inReadingOrder.map((paragraph, index) => [paragraph.id, index]));
  const neighbour = (paragraph: Paragraph | undefined, offset: number): string | null => {
    const position = paragraph === undefined ? undefined : positionOf.get(paragraph.id);
    return position === undefined ? null : (inReadingOrder[position + offset]?.text ?? null);
  };
  const materials = materialsFor(options);

  const jobs: TranslationJob[] = [];
  const unparsed: UnparsedInJob[] = [];
  const emptySections: Section[] = [];
  let referenceRuns = 0;

  sections.forEach((section, position) => {
    if (options.sections && !options.sections.has(section.ordinal + 1)) return;
    const paragraphs = bySection.get(section.id) ?? [];
    if (paragraphs.length === 0) {
      emptySections.push(section);
      return;
    }
    const parts = splitIntoParts(paragraphs, (p) => countWords(p.text), chunk);
    const previousSectionHeading = sections[position - 1]?.heading ?? null;
    parts.forEach((part, partIndex) => {
      const jobId = jobIdFor(slug, targetLanguage, section.ordinal, partIndex);
      const jobParagraphs = part.map((paragraph) => {
        const runs = parseSourceReferences(paragraph.text);
        referenceRuns += runs.length;
        const fragments = findUnparsedReferenceFragments(paragraph.text, runs);
        if (fragments.length > 0) unparsed.push({ jobId, sourceId: paragraph.id, fragments });
        return {
          id: paragraph.id,
          ordinal: paragraph.ordinal,
          kind: paragraph.kind,
          text: paragraph.text,
          references: runs.map((run) => ({
            source: run.source,
            target: run.target,
            canonical: run.canonical,
          })),
        };
      });
      jobs.push({
        jobId,
        workSlug: slug,
        sourceEditionId: edition.edition.id,
        sourceLanguage: edition.edition.language,
        targetLanguage,
        section: {
          id: section.id,
          ordinal: section.ordinal,
          kind: section.kind,
          heading: section.heading,
        },
        part: partIndex,
        parts: parts.length,
        paragraphs: jobParagraphs,
        context: {
          previousParagraph: neighbour(part[0], -1),
          nextParagraph: neighbour(part[part.length - 1], 1),
          previousSectionHeading,
        },
        wordCount: jobParagraphs.reduce((sum, p) => sum + countWords(p.text), 0),
        materials,
      });
    });
  });

  const index: JobIndex = {
    workSlug: slug,
    sourceEditionId: edition.edition.id,
    targetLanguage,
    sourceSha256: options.sourceSha256,
    jobs: jobs.map((job) => ({
      jobId: job.jobId,
      file: `${job.jobId}.json`,
      sectionOrdinal: job.section.ordinal,
      part: job.part,
      parts: job.parts,
      paragraphs: job.paragraphs.length,
      words: job.wordCount,
    })),
  };
  return { jobs, index, referenceRuns, unparsed, emptySections };
}
