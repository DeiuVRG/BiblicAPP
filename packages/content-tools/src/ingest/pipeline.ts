import { PackSchema } from '@biblioteca/shared';
import type { Edition, Pack, Work } from '@biblioteca/shared';

import type { IngestConfig } from './config';
import { isAllCapsHeading, parseChapterMarker } from './headings';
import {
  buildVocabulary,
  joinLines,
  type HyphenChoice,
  type HyphenOptions,
  type Vocabulary,
} from './hyphenation';
import { assignIds, type DraftSection, type IdSource } from './ids';
import {
  detectRunningHeads,
  stripFurniture,
  type FurnitureOptions,
  type HeadModel,
  type RemovedLine,
} from './furniture';
import { segmentParagraphs, type BodyLine } from './paragraphs';
import { typographicQuotes } from './quotes';
import { collapse, splitPages } from './text';

export interface IngestMeta {
  work: Work;
  edition: Edition;
}

export interface IngestInput {
  raw: string;
  config: IngestConfig;
  meta: IngestMeta;
  keepFrontMatter?: boolean;
  /** Previously ingested canonical content: its ids are reused. */
  previous?: IdSource;
}

export interface IngestReport {
  pages: number;
  bodyPages: number;
  frontMatterPages: number;
  chapters: { number: string; heading: string; paragraphs: number; rawHeading: string }[];
  paragraphs: number;
  paragraphMode: 'layout' | 'length' | 'n/a';
  headFamilies: string[];
  removedHeads: number;
  removedFeet: RemovedLine[];
  hyphenChoices: HyphenChoice[];
  /** Indented lines that did not start a paragraph (previous line not terminated). */
  suspects: { page: number; text: string }[];
  idsReused: number;
  idsCreated: number;
  warnings: string[];
}

export interface IngestResult {
  pack: Pack;
  report: IngestReport;
}

interface PageLines {
  /** 1-based page number in the raw file. */
  page: number;
  lines: string[];
}

function compile(source: string, flags = ''): RegExp {
  return new RegExp(source, flags);
}

export function applyPageFixes(pages: string[], config: IngestConfig): string[] {
  const result = [...pages];
  for (const fix of config.pageFixes) {
    const text = result[fix.page - 1];
    if (text === undefined) throw new Error(`pageFix: page ${fix.page} does not exist`);
    if (!text.includes(fix.find)) {
      throw new Error(`pageFix: text not found on page ${fix.page}: ${JSON.stringify(fix.find)}`);
    }
    result[fix.page - 1] = text.replace(fix.find, () => fix.replace);
  }
  return result;
}

/** Applies config replacements, word fixes, whitespace and quote normalisation to a paragraph. */
export function cleanText(text: string, config: IngestConfig): string {
  let out = text;
  for (const replacement of config.replacements) {
    out = out.replace(compile(replacement.pattern, replacement.flags), replacement.replace);
  }
  const fixes = new Map(Object.entries(config.wordFixes));
  if (fixes.size > 0) out = out.replace(/\p{L}+/gu, (word) => fixes.get(word) ?? word);
  out = collapse(out);
  if (config.typographicQuotes) out = typographicQuotes(out);
  return out;
}

export function ingest(input: IngestInput): IngestResult {
  const { config, meta } = input;
  const warnings: string[] = [];
  const rawPages = applyPageFixes(splitPages(input.raw), config);
  const pages: PageLines[] = rawPages.map((text, index) => ({
    page: index + 1,
    lines: text.split('\n').map((line) => line.replace(/\s+$/, '')),
  }));

  const firstMarker = compile(config.firstChapterMarker);
  const chapterMarker = compile(config.chapterMarker);
  const endMarker = config.endMarker ? compile(config.endMarker) : undefined;

  // Locate the first chapter and the end of the body.
  let startPage = -1;
  let startLine = -1;
  for (let p = 0; p < pages.length && startPage < 0; p += 1) {
    const index = (pages[p] as PageLines).lines.findIndex((l) => firstMarker.test(l));
    if (index >= 0) {
      startPage = p;
      startLine = index;
    }
  }
  if (startPage < 0) throw new Error('first chapter marker not found (firstChapterMarker)');

  let endPage = pages.length - 1;
  if (endMarker) {
    let found = false;
    for (let p = startPage; p < pages.length && !found; p += 1) {
      const from = p === startPage ? startLine : 0;
      const page = pages[p] as PageLines;
      const index = page.lines.findIndex((l, i) => i >= from && endMarker.test(l));
      if (index >= 0) {
        page.lines = page.lines.slice(0, index);
        endPage = p;
        found = true;
      }
    }
    if (!found) warnings.push('endMarker not found: the whole tail is treated as body');
  }

  const frontMatter: PageLines[] = pages.slice(0, startPage).map((p) => ({ ...p }));
  const startPageLines = pages[startPage] as PageLines;
  if (startLine > 0) {
    frontMatter.push({
      page: startPageLines.page,
      lines: startPageLines.lines.slice(0, startLine),
    });
    startPageLines.lines = startPageLines.lines.slice(startLine);
  }
  const body: PageLines[] = pages.slice(startPage, endPage + 1);

  // Running heads and foot furniture.
  const isOpening = (page: PageLines): boolean => page.lines.some((l) => chapterMarker.test(l));
  const headOptions = {
    zoneLines: config.headers.zoneLines,
    minRepeats: config.headers.minRepeats,
    similarity: config.headers.similarity,
  };
  const model: HeadModel = detectRunningHeads(
    body.filter((p) => !isOpening(p)),
    headOptions,
  );
  const furnitureOptions: FurnitureOptions = {
    ...headOptions,
    extraPatterns: config.headers.extraPatterns.map((p) => compile(p)),
    footZoneLines: config.footers.zoneLines,
    footMaxChars: config.footers.maxChars,
  };
  let removedHeads = 0;
  const removedFeet: RemovedLine[] = [];
  const cleaned: PageLines[] = body.map((page) => {
    const result = stripFurniture(page, model, furnitureOptions, isOpening(page));
    for (const r of result.removed) {
      if (r.where === 'head') removedHeads += 1;
      else removedFeet.push({ where: 'foot', text: `p${page.page}: ${r.text}` });
    }
    const noise = config.lineNoise.map((p) => compile(p));
    const lines = result.lines
      .filter((line) => {
        const visible = line.replace(/\s/g, '').length;
        return visible === 0 || visible > config.noiseLineMaxChars;
      })
      .map((line) => {
        let out = line;
        for (const re of noise) {
          const stripped = out.replace(re, '');
          if (stripped.trim().length >= 12) out = stripped;
        }
        return out;
      });
    return { page: page.page, lines };
  });

  const vocabulary: Vocabulary = buildVocabulary(cleaned.flatMap((p) => p.lines));
  const hyphenOptions: HyphenOptions = {
    keep: new Set(config.hyphenation.keep.map((w) => w.toLowerCase())),
    join: new Set(config.hyphenation.join.map((w) => w.toLowerCase())),
  };
  const hyphenChoices: HyphenChoice[] = [];
  const suspects: { page: number; text: string }[] = [];
  let paragraphMode: IngestReport['paragraphMode'] = 'n/a';

  // Assemble chapters.
  interface Chapter {
    number: string;
    rawHeading: string;
    lines: BodyLine[];
  }
  const headingLinesByNumber = new Map(
    config.chapters.flatMap((c) => (c.headingLines ? [[c.number, c.headingLines] as const] : [])),
  );
  const chapters: Chapter[] = [];
  let current: Chapter | undefined;
  let expected = 1;
  for (const page of cleaned) {
    for (let i = 0; i < page.lines.length; i += 1) {
      const line = page.lines[i] as string;
      const marker = parseChapterMarker(line, chapterMarker);
      if (marker) {
        if (marker.value !== expected) {
          warnings.push(
            `chapter numbering: expected ${expected}, found ${marker.number} (p${page.page})`,
          );
        }
        expected = marker.value + 1;
        // Heading block: non-empty lines after the marker up to the next blank line.
        let j = i + 1;
        while (j < page.lines.length && (page.lines[j] as string).trim() === '') j += 1;
        const headingLines: string[] = [];
        const limit = headingLinesByNumber.get(marker.number) ?? Infinity;
        while (
          j < page.lines.length &&
          (page.lines[j] as string).trim() !== '' &&
          headingLines.length < limit
        ) {
          headingLines.push(page.lines[j] as string);
          j += 1;
        }
        current = {
          number: marker.number,
          rawHeading: joinLines(headingLines, vocabulary, hyphenOptions).text,
          lines: [],
        };
        chapters.push(current);
        i = j - 1;
        continue;
      }
      if (current) current.lines.push({ text: line, page: page.page });
    }
  }
  if (chapters.length === 0) throw new Error('no chapters found (chapterMarker)');

  const drafts: DraftSection[] = [];
  const reportChapters: IngestReport['chapters'] = [];
  const headingByNumber = new Map(config.chapters.map((c) => [c.number, c.heading]));

  const makeParagraphs = (lines: BodyLine[]): { kind: 'p' | 'heading'; text: string }[] => {
    const out: { kind: 'p' | 'heading'; text: string }[] = [];
    const flush = (group: BodyLine[]): void => {
      if (group.length === 0) return;
      const segmented = segmentParagraphs(group, config.paragraphs);
      paragraphMode = segmented.mode;
      suspects.push(...segmented.suspects);
      for (const paragraph of segmented.paragraphs) {
        const joined = joinLines(
          paragraph.map((l) => l.text),
          vocabulary,
          hyphenOptions,
        );
        hyphenChoices.push(...joined.choices);
        const text = cleanText(joined.text, config);
        if (text !== '') out.push({ kind: 'p', text });
      }
    };
    let group: BodyLine[] = [];
    for (const line of lines) {
      if (config.allCapsHeadings && isAllCapsHeading(line.text)) {
        flush(group);
        group = [];
        out.push({ kind: 'heading', text: cleanText(line.text, config) });
      } else {
        group.push(line);
      }
    }
    flush(group);
    return out;
  };

  chapters.forEach((chapter, index) => {
    const configured = headingByNumber.get(chapter.number);
    const rawHeading = cleanText(chapter.rawHeading, config);
    if (configured === undefined) {
      warnings.push(
        `chapter ${chapter.number}: no configured heading, using OCR text "${rawHeading}"`,
      );
    }
    const heading = config.headingTemplate
      .replace('{number}', chapter.number)
      .replace('{heading}', configured ?? rawHeading);
    const paragraphs = makeParagraphs(chapter.lines);
    drafts.push({ ordinal: index, kind: 'chapter', heading, paragraphs });
    reportChapters.push({
      number: chapter.number,
      heading,
      paragraphs: paragraphs.length,
      rawHeading,
    });
  });

  if (input.keepFrontMatter) {
    const lines: BodyLine[] = frontMatter.flatMap((p) =>
      p.lines.map((text) => ({ text, page: p.page })),
    );
    const blocks: string[][] = [[]];
    for (const line of lines) {
      if (line.text.trim() === '') {
        if ((blocks[blocks.length - 1] as string[]).length > 0) blocks.push([]);
      } else {
        (blocks[blocks.length - 1] as string[]).push(line.text);
      }
    }
    const paragraphs = blocks
      .filter((b) => b.length > 0)
      .map((b) => ({
        kind: 'p' as const,
        text: cleanText(joinLines(b, vocabulary, hyphenOptions).text, config),
      }))
      .filter((p) => p.text !== '');
    for (const draft of drafts) draft.ordinal += 1;
    drafts.unshift({ ordinal: 0, kind: 'section', heading: 'Front matter', paragraphs });
  }

  const ids = assignIds(drafts, input.previous);
  const pack: Pack = PackSchema.parse({
    work: meta.work,
    edition: meta.edition,
    sections: ids.sections,
    paragraphs: ids.paragraphs,
  });

  return {
    pack,
    report: {
      pages: pages.length,
      bodyPages: body.length,
      frontMatterPages: frontMatter.length,
      chapters: reportChapters,
      paragraphs: pack.paragraphs.length,
      paragraphMode,
      headFamilies: model.families.map((f) => `${f.key} (${f.pages})`),
      removedHeads,
      removedFeet,
      hyphenChoices,
      suspects,
      idsReused: ids.reused,
      idsCreated: ids.created,
      warnings,
    },
  };
}
