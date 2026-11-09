/**
 * Shared steps of the `build-edition.ts` scripts of the creeds shelf (P1-C4): one source edition
 * of a short document, made from a verbatim excerpt of the CCEL ThML file kept next to the script.
 *
 * Scripts import from the packages by relative path because `@biblioteca/shared` is not resolvable
 * from `content/` (it is a dependency of the packages, not of the root). Run a script from the
 * repository root with `node_modules/.bin/tsx content/sources/<slug>/build-edition.ts`.
 *
 * What a script does, in order (everything is checked, nothing is silent):
 *   1. reads the ThML excerpt (NFC) and takes the text of the cells of one language;
 *   2. applies the corrections of SOURCE.md, each of which must match exactly once;
 *   3. cuts the text into articles at markers (each must occur exactly once) and checks that the
 *      articles joined by one space are the corrected text again;
 *   4. gives `work.json` its ids once (`ensureIds`), reuses the ids of an edition file that exists,
 *      and writes `edition-<lang>.json` as a `PackSchema` object;
 *   5. writes the metadata of the translations (`translation-en`, `translation-ro`) when they do
 *      not exist yet, and keeps `edition.sourceEditionId` right in the ones that do.
 */
import fs from 'node:fs';
import path from 'node:path';

import { stableId } from '../../../packages/shared/src/ids';
import { PackSchema } from '../../../packages/shared/src/schemas';
import type { Pack, Paragraph, Section } from '../../../packages/shared/src/schemas';
import {
  ensureIds,
  loadWorkMeta,
  saveWorkMeta,
} from '../../../packages/content-tools/src/work-file';
import { TranslationEditionMetaSchema } from '../../../packages/content-tools/src/translation/schemas';
import type { TranslationEditionMeta } from '../../../packages/content-tools/src/translation/schemas';

/** A correction of the text of the source, with the reason that SOURCE.md also gives. */
export interface Correction {
  readonly from: string;
  readonly to: string;
  readonly why: string;
}

export type Column = 'latin' | 'greek';

/** The metadata of one translation, without the id of the source edition (known after the build). */
export type TranslationMetaTemplate = Omit<TranslationEditionMeta['edition'], 'sourceEditionId'> & {
  readonly workTitle: string;
};

export interface SourceEditionConfig {
  /** Absolute path of the repository root. */
  readonly repoRoot: string;
  readonly slug: string;
  /** File name of the edition: `edition-la.json`. */
  readonly editionFile: string;
  /** Language of the edition, as in `work.json`. */
  readonly language: 'la' | 'grc';
  /** The ThML excerpt, absolute path. */
  readonly thmlFile: string;
  readonly column: Column;
  readonly corrections: readonly Correction[];
  /** The first words of each article, in order; the first one starts the text. */
  readonly articleStarts: readonly string[];
  /** The metadata of the translations, given the id of the source edition. */
  readonly translations: (
    sourceEditionId: string,
  ) => Readonly<Record<'en' | 'ro', TranslationMetaTemplate>>;
}

const NOTE = /<note\b[\s\S]*?<\/note>/g;

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function plain(markup: string): string {
  return decodeEntities(markup.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The text of the table cells that hold the wanted language, footnotes (`<note>`) removed, cells
 * joined by one space. A cell counts for Greek when it has a span of class `Greek` outside its
 * footnotes, for Latin when it has a span with `lang="LA"`. The punctuation printed outside the
 * span of a cell is part of the cell, so the whole cell is taken, not only the span.
 */
export function columnText(thml: string, column: Column): string {
  const cells: string[] = [];
  for (const table of thml.match(/<table\b[\s\S]*?<\/table>/g) ?? []) {
    for (const cell of table.match(/<td\b[\s\S]*?<\/td>/g) ?? []) {
      const body = cell.replace(NOTE, '');
      const wanted = column === 'latin' ? /\blang="LA"/.test(body) : /\bclass="Greek"/.test(body);
      if (wanted) cells.push(plain(body));
    }
  }
  if (cells.length === 0) throw new Error(`no ${column} cell in the excerpt`);
  return cells.join(' ');
}

function occurrences(text: string, part: string): number {
  return part === '' ? 0 : text.split(part).length - 1;
}

/** Applies the corrections in order; each `from` must occur exactly once in the text at its turn. */
export function applyCorrections(text: string, corrections: readonly Correction[]): string {
  let current = text;
  for (const correction of corrections) {
    const count = occurrences(current, correction.from);
    if (count !== 1) {
      throw new Error(
        `correction "${correction.from}" -> "${correction.to}" matches ${count} times (expected 1)`,
      );
    }
    current = current.replace(correction.from, () => correction.to);
  }
  return current;
}

/**
 * Cuts the text into articles, each starting at one of the markers (the first at position 0). The
 * articles joined by one space must give the text back: the division adds and removes nothing.
 */
export function splitAtMarkers(text: string, markers: readonly string[]): string[] {
  const starts = markers.map((marker) => {
    const count = occurrences(text, marker);
    if (count !== 1)
      throw new Error(`article start "${marker}" occurs ${count} times (expected 1)`);
    return text.indexOf(marker);
  });
  if (starts[0] !== 0) throw new Error('the first article start is not the start of the text');
  starts.forEach((start, index) => {
    const previous = starts[index - 1];
    if (previous !== undefined && start <= previous) {
      throw new Error(`article start "${markers[index]}" is not after "${markers[index - 1]}"`);
    }
  });
  const articles = starts.map((start, index) =>
    text.slice(start, starts[index + 1] ?? text.length).trim(),
  );
  if (articles.join(' ') !== text) throw new Error('the articles joined are not the text');
  return articles;
}

function writeJson(file: string, value: unknown): boolean {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function buildSourceEdition(config: SourceEditionConfig): void {
  const worksDir = path.join(config.repoRoot, 'content/works', config.slug);
  const workFile = path.join(worksDir, 'work.json');
  const editionPath = path.join(worksDir, config.editionFile);

  const thml = fs.readFileSync(config.thmlFile, 'utf8').normalize('NFC');
  const extracted = columnText(thml, config.column);
  const text = applyCorrections(extracted, config.corrections);
  if (text !== text.normalize('NFC')) throw new Error('the corrected text is not NFC');
  const articles = splitAtMarkers(text, config.articleStarts);

  const { meta, changed } = ensureIds(loadWorkMeta(workFile));
  if (meta.work.slug !== config.slug) throw new Error(`work.json has slug ${meta.work.slug}`);
  if (meta.work.languageOrig !== config.language || meta.edition.language !== config.language) {
    throw new Error(`work.json is not in language ${config.language}`);
  }
  if (meta.edition.kind !== 'source') throw new Error('work.json describes a translation');
  if (changed) saveWorkMeta(workFile, meta);

  // Ids are generated once: an edition file that exists keeps its ids, matched by position.
  const previous = fs.existsSync(editionPath) ? PackSchema.parse(readJson(editionPath)) : undefined;
  const previousSections = [...(previous?.sections ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const sections: Section[] = [];
  const paragraphs: Paragraph[] = [];
  articles.forEach((article, index) => {
    const before = previousSections[index];
    const sectionId = before?.id ?? stableId();
    const paragraphBefore = previous?.paragraphs.find(
      (paragraph) => paragraph.sectionId === before?.id && paragraph.ordinal === 0,
    );
    sections.push({ id: sectionId, ordinal: index, kind: 'section', heading: String(index + 1) });
    paragraphs.push({
      id: paragraphBefore?.id ?? stableId(),
      sectionId,
      ordinal: 0,
      kind: 'p',
      text: article,
    });
  });

  const pack: Pack = PackSchema.parse({
    work: meta.work,
    edition: meta.edition,
    sections,
    paragraphs,
  });
  const wrote = writeJson(editionPath, pack);

  // The translations: metadata is written once, then only `sourceEditionId` is kept right (the
  // first merge also stores the id of the translated edition in this file).
  const metaFiles: string[] = [];
  for (const lang of ['en', 'ro'] as const) {
    const file = path.join(worksDir, `translation-${lang}`, 'edition.json');
    const sourceEditionId = pack.edition.id;
    const { workTitle, ...edition } = config.translations(sourceEditionId)[lang];
    if (fs.existsSync(file)) {
      const current = TranslationEditionMetaSchema.parse(readJson(file));
      if (current.edition.sourceEditionId !== sourceEditionId) {
        writeJson(file, { ...current, edition: { ...current.edition, sourceEditionId } });
      }
    } else {
      writeJson(
        file,
        TranslationEditionMetaSchema.parse({ workTitle, edition: { ...edition, sourceEditionId } }),
      );
    }
    metaFiles.push(path.relative(config.repoRoot, file));
  }

  const out = process.stdout;
  out.write(
    `${config.slug}: ${pack.sections.length} sections, ${pack.paragraphs.length} paragraphs, `,
  );
  out.write(`${wordCount(text)} words; ${path.relative(config.repoRoot, editionPath)} `);
  out.write(`${wrote ? 'written' : 'unchanged'}${changed ? '; ids added to work.json' : ''}\n`);
  for (const correction of config.corrections) {
    out.write(`  correction: "${correction.from}" -> "${correction.to}"\n`);
  }
  pack.paragraphs.forEach((paragraph, index) => {
    out.write(`  ${pack.sections[index]?.heading ?? '?'}  ${paragraph.text}\n`);
  });
  out.write(`  translation metadata: ${metaFiles.join(', ')}\n`);
}
