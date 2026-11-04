import { romanToInt } from '../ingest/headings';
import {
  ENGLISH_BOOK_PATTERN,
  ROMANIAN_BOOK_PATTERN,
  lookupEnglishBook,
  lookupRomanianBook,
  sameRomanianAbbreviation,
} from './books';
import type { BookInfo } from './books';

/**
 * Scripture references (docs/traducere-pipeline.md, section 5). Pure functions:
 *
 * - `parseSourceReferences` finds the runs of references in English text (roman chapter
 *   numerals, `Matt. iv. 17; Mk. i. 15`), with canonical items and the Romanian rendering;
 * - `extractTargetReferences` reads the Romanian notation back into the same canonical items;
 * - `compareReferences` compares the two as multisets.
 *
 * Extensions of the written grammar, all needed by the Vos text: a bare chapter at the start of
 * a run (`xviii. 36`, the book is only implied) is a bookless reference; `Book chapter` without
 * verses (`Matt. xiii`) is a chapter reference; `vs. 28` without an antecedent in its run
 * inherits the last reference of the paragraph; `and xviii. 17` continues a run like `;` does.
 */

const MAX_CHAPTER = 150;
const MAX_VERSE = 176;

export type JoinerKind = 'semicolon' | 'comma' | 'comma-with' | 'comma-and' | 'with' | 'and';

/** One verse or range of verses; `following` marks `ff.` / `f.` / `ș.urm.`. */
export interface VerseItem {
  from: string;
  to?: string;
  following?: boolean;
}

interface SegmentBase {
  verses: VerseItem[];
  /** How this segment is attached to the previous one of its run. */
  joiner?: JoinerKind;
  start: number;
  end: number;
}

/** `Matt. iv. 17`, `Obad. 21` (chapter null) or `Matt. xiii` (no verses). */
export interface BookSegment extends SegmentBase {
  lead: 'book';
  book: BookInfo;
  chapter: number | null;
}

/** `xviii. 36`: a chapter that inherits the book of the previous segment of the run. */
export interface ChapterSegment extends SegmentBase {
  lead: 'chapter';
  chapter: number;
}

/** `vs. 23`: verses of the book and chapter that came before. */
export interface VerseSegment extends SegmentBase {
  lead: 'verse';
  plural: boolean;
}

export type Segment = BookSegment | ChapterSegment | VerseSegment;

interface Resolved {
  book: BookInfo | null;
  chapter: number | null;
}

export interface ReferenceRun {
  /** Offsets in the text; `end` is exclusive. */
  start: number;
  end: number;
  /** The run exactly as written in the source text. */
  source: string;
  /** The run in Romanian notation. */
  target: string;
  /** Canonical items, e.g. `Matt 4:17`, `Obad 21`, `Matt 18:23ff`. */
  canonical: string[];
  segments: readonly Segment[];
}

export interface ExtractedReference {
  start: number;
  end: number;
  text: string;
  canonical: string[];
}

// ---------------------------------------------------------------------------------------------
// Low-level matching

function sticky(source: string, flags = ''): RegExp {
  return new RegExp(source, `${flags}y`);
}

function matchAt(re: RegExp, text: string, pos: number): RegExpExecArray | null {
  re.lastIndex = pos;
  return re.exec(text);
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

function validVerse(digits: string): boolean {
  const value = Number.parseInt(digits, 10);
  return value >= 1 && value <= MAX_VERSE;
}

function validChapter(value: number): boolean {
  return value >= 1 && value <= MAX_CHAPTER;
}

function toRoman(value: number): string {
  const table: [number, string][] = [
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = value;
  let out = '';
  for (const [size, letters] of table) {
    while (rest >= size) {
      out += letters;
      rest -= size;
    }
  }
  return out;
}

/** Strict roman numeral, one case only, value 1..150 (no `IIII`, no `IC`). */
function parseRoman(token: string): number | null {
  if (token !== token.toLowerCase() && token !== token.toUpperCase()) return null;
  const value = romanToInt(token);
  if (value === null || !validChapter(value)) return null;
  return toRoman(value) === token.toUpperCase() ? value : null;
}

// ---------------------------------------------------------------------------------------------
// Verse lists (shared by both notations)

const RANGE = sticky(
  String.raw`(\d{1,3}[a-d]?)(?![A-Za-z0-9]|:\d)(?:\s*[-\u2010-\u2015]\s*(\d{1,3}[a-d]?)(?![A-Za-z0-9]|:\d))?`,
);
const COMMA = sticky(String.raw`\s*,\s*`);
const GAP_NUMBER = sticky(String.raw`\s+(\d{1,3})(?![A-Za-z0-9])`);
const AFTER_REFERENCE = sticky(String.raw`\s*(?:[.,;:)\]”’"]|$)`);
const SOURCE_FOLLOWING = sticky(String.raw`\s*ff?(?![A-Za-z0-9])\.?`);
const TARGET_FOLLOWING = sticky(
  String.raw`\s*(?:[\u0219\u015F]\.\s*urm\.?|[\u0219\u015F]i\s+urm\.?)`,
);

interface VerseList {
  verses: VerseItem[];
  end: number;
}

function matchRange(text: string, pos: number): { item: VerseItem; end: number } | null {
  const match = matchAt(RANGE, text, pos);
  const from = match?.[1];
  if (!match || from === undefined || !validVerse(from)) return null;
  const to = match[2];
  if (to !== undefined && !validVerse(to)) return null;
  const item: VerseItem = to === undefined ? { from } : { from, to };
  return { item, end: pos + match[0].length };
}

/**
 * Two plain numbers separated only by white space (`32 35.`) are a range whose dash the OCR
 * lost, but only when the second number closes the reference (so `3 2 Cor.` is left alone).
 */
function mergeLostHyphen(text: string, end: number, verses: VerseItem[]): number | null {
  const last = verses[verses.length - 1];
  if (!last || last.to !== undefined || !/^\d+$/.test(last.from)) return null;
  const gap = matchAt(GAP_NUMBER, text, end);
  const second = gap?.[1];
  if (!gap || second === undefined || !validVerse(second)) return null;
  if (Number.parseInt(second, 10) <= Number.parseInt(last.from, 10)) return null;
  const secondEnd = end + gap[0].length;
  if (!matchAt(AFTER_REFERENCE, text, secondEnd)) return null;
  last.to = second;
  return secondEnd;
}

function parseVerseList(text: string, pos: number, following: RegExp): VerseList | null {
  const first = matchRange(text, pos);
  if (!first) return null;
  const verses: VerseItem[] = [first.item];
  let end = first.end;
  for (;;) {
    const comma = matchAt(COMMA, text, end);
    if (comma) {
      const next = matchRange(text, end + comma[0].length);
      if (!next) break;
      verses.push(next.item);
      end = next.end;
      continue;
    }
    const merged = mergeLostHyphen(text, end, verses);
    if (merged === null) break;
    end = merged;
  }
  const marker = matchAt(following, text, end);
  const last = verses[verses.length - 1];
  if (marker && last) {
    last.following = true;
    end += marker[0].length;
  }
  return { verses, end };
}

// ---------------------------------------------------------------------------------------------
// Joiners between the segments of a run

interface Joiner {
  kind: JoinerKind;
  end: number;
}

const ALLOWED_LEADS: Record<JoinerKind, ReadonlySet<Segment['lead']>> = {
  semicolon: new Set(['book', 'chapter', 'verse']),
  'comma-and': new Set(['chapter', 'verse']),
  and: new Set(['chapter', 'verse']),
  comma: new Set(['verse']),
  'comma-with': new Set(['verse']),
  with: new Set(['verse']),
};

const SOURCE_JOINERS: readonly [RegExp, JoinerKind][] = [
  [sticky(String.raw`\s*;\s*`), 'semicolon'],
  [sticky(String.raw`\s*,\s*with\s+`), 'comma-with'],
  [sticky(String.raw`\s*,\s*and\s+`), 'comma-and'],
  [sticky(String.raw`\s*,\s*`), 'comma'],
  [sticky(String.raw`\s+with\s+`), 'with'],
  [sticky(String.raw`\s+and\s+`), 'and'],
];

const TARGET_JOINERS: readonly [RegExp, JoinerKind][] = [
  [sticky(String.raw`\s*;\s*`), 'semicolon'],
  [sticky(String.raw`\s*,\s*cu\s+`), 'comma-with'],
  [sticky(String.raw`\s*,\s*[\u0219\u015F]i\s+`), 'comma-and'],
  [sticky(String.raw`\s*,\s*`), 'comma'],
  [sticky(String.raw`\s+cu\s+`), 'with'],
  [sticky(String.raw`\s+[\u0219\u015F]i\s+`), 'and'],
];

function matchJoiner(
  table: readonly [RegExp, JoinerKind][],
  text: string,
  pos: number,
): Joiner | null {
  for (const [re, kind] of table) {
    const match = matchAt(re, text, pos);
    if (match) return { kind, end: pos + match[0].length };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// English (source) segments

const EN_BOOK = sticky(
  String.raw`(?<![A-Za-z0-9])(?:([123])\s?)?(${ENGLISH_BOOK_PATTERN})(?![A-Za-z])(\.?)`,
);
const EN_VERSE_MARKER = sticky(String.raw`(?<![A-Za-z0-9])(?:vss?|vers?)\.\s*(?=\d)`, 'i');
const ROMAN = sticky(String.raw`([ivxlcIVXLC]{1,8})(?![A-Za-z0-9])`);
const CHAPTER_DOT = sticky(String.raw`\s*\.\s*`);
const DIGIT = sticky(String.raw`\d`);
const SPACES = sticky(String.raw`\s*`);

function skipSpaces(text: string, pos: number): number {
  const match = matchAt(SPACES, text, pos);
  return pos + (match?.[0].length ?? 0);
}

/** A chapter that is only named (`Matt. xiii`) must be lower case and not look like a word. */
function chapterOnlyAllowed(token: string, name: string, hasPeriod: boolean): boolean {
  return token === token.toLowerCase() && (hasPeriod || name.length >= 3);
}

function parseEnglishBook(text: string, pos: number): BookSegment | null {
  const match = matchAt(EN_BOOK, text, pos);
  if (!match) return null;
  const name = match[2] ?? '';
  const book = lookupEnglishBook(match[1], name);
  if (!book) return null;
  const hasPeriod = match[3] === '.';
  const afterBook = skipSpaces(text, pos + match[0].length);

  if (book.singleChapter) {
    const list = parseVerseList(text, afterBook, SOURCE_FOLLOWING);
    return list
      ? { lead: 'book', book, chapter: null, verses: list.verses, start: pos, end: list.end }
      : null;
  }

  const roman = matchAt(ROMAN, text, afterBook);
  const token = roman?.[1];
  if (!roman || token === undefined) return null;
  const chapter = parseRoman(token);
  if (chapter === null) return null;
  const afterChapter = afterBook + roman[0].length;

  const dot = matchAt(CHAPTER_DOT, text, afterChapter);
  if (dot) {
    const versesAt = afterChapter + dot[0].length;
    const list = parseVerseList(text, versesAt, SOURCE_FOLLOWING);
    if (list) {
      return { lead: 'book', book, chapter, verses: list.verses, start: pos, end: list.end };
    }
    // Digits after the period that are not a verse list: malformed, do not guess.
    if (matchAt(DIGIT, text, versesAt)) return null;
  }
  if (!chapterOnlyAllowed(token, name, hasPeriod)) return null;
  return { lead: 'book', book, chapter, verses: [], start: pos, end: afterChapter };
}

function parseEnglishVerse(text: string, pos: number): VerseSegment | null {
  const marker = matchAt(EN_VERSE_MARKER, text, pos);
  if (!marker) return null;
  const list = parseVerseList(text, pos + marker[0].length, SOURCE_FOLLOWING);
  if (!list) return null;
  const plural = /^vss/i.test(marker[0]);
  return { lead: 'verse', plural, verses: list.verses, start: pos, end: list.end };
}

/**
 * A bare chapter. At the start of a run the book is unknown, so only lower-case numerals that
 * are unlikely to be abbreviations qualify (not `c.` or `l.`).
 */
function parseEnglishChapter(text: string, pos: number, startsRun: boolean): ChapterSegment | null {
  const roman = matchAt(ROMAN, text, pos);
  const token = roman?.[1];
  if (!roman || token === undefined) return null;
  const chapter = parseRoman(token);
  if (chapter === null) return null;
  if (
    startsRun &&
    (token !== token.toLowerCase() || (token.length < 2 && !'ivx'.includes(token)))
  ) {
    return null;
  }
  const dot = matchAt(CHAPTER_DOT, text, pos + roman[0].length);
  if (!dot) return null;
  const list = parseVerseList(text, pos + roman[0].length + dot[0].length, SOURCE_FOLLOWING);
  if (!list) return null;
  return { lead: 'chapter', chapter, verses: list.verses, start: pos, end: list.end };
}

function parseEnglishSegment(text: string, pos: number, startsRun: boolean): Segment | null {
  return (
    parseEnglishBook(text, pos) ??
    parseEnglishVerse(text, pos) ??
    parseEnglishChapter(text, pos, startsRun)
  );
}

// ---------------------------------------------------------------------------------------------
// Romanian (target) segments

const RO_BOOK = sticky(
  String.raw`(?<![\p{L}\p{N}])(?:([123])\s?)?(${ROMANIAN_BOOK_PATTERN})(\.?)(?![\p{L}])`,
  'u',
);
const RO_VERSE_MARKER = sticky(String.raw`(?<![\p{L}\p{N}])(vv?)\.\s*(?=\d)`, 'u');
const RO_NUMBER = sticky(String.raw`\s*(\d{1,3})(?!\d)`);
const RO_COLON = sticky(String.raw`\s*:\s*(?=\d)`);
const RO_CHAPTER_COLON = sticky(String.raw`(\d{1,3})\s*:\s*(?=\d)`);

function parseRomanianBook(text: string, pos: number): BookSegment | null {
  const match = matchAt(RO_BOOK, text, pos);
  if (!match) return null;
  const book = lookupRomanianBook(match[1], match[2] ?? '');
  if (!book) return null;
  const hasPeriod = match[3] === '.';
  const number = matchAt(RO_NUMBER, text, pos + match[0].length);
  const digits = number?.[1];
  if (!number || digits === undefined) return null;
  const numberStart = pos + match[0].length;
  const numberEnd = numberStart + number[0].length;
  const colon = matchAt(RO_COLON, text, numberEnd);

  if (book.singleChapter) {
    // `Obad. 21`; `Obad. 1:21` is accepted and means the same.
    if (colon && Number.parseInt(digits, 10) !== 1) return null;
    const versesAt = colon ? numberEnd + colon[0].length : numberStart;
    const list = parseVerseList(text, skipSpaces(text, versesAt), TARGET_FOLLOWING);
    return list
      ? { lead: 'book', book, chapter: null, verses: list.verses, start: pos, end: list.end }
      : null;
  }

  const chapter = Number.parseInt(digits, 10);
  if (!validChapter(chapter)) return null;
  if (colon) {
    const list = parseVerseList(text, numberEnd + colon[0].length, TARGET_FOLLOWING);
    return list
      ? { lead: 'book', book, chapter, verses: list.verses, start: pos, end: list.end }
      : null;
  }
  // A chapter that is only named is accepted in exactly the notation of the table.
  if (hasPeriod !== book.ro.endsWith('.')) return null;
  return { lead: 'book', book, chapter, verses: [], start: pos, end: numberEnd };
}

function parseRomanianVerse(text: string, pos: number): VerseSegment | null {
  const marker = matchAt(RO_VERSE_MARKER, text, pos);
  if (!marker) return null;
  const list = parseVerseList(text, pos + marker[0].length, TARGET_FOLLOWING);
  if (!list) return null;
  return {
    lead: 'verse',
    plural: marker[1] === 'vv',
    verses: list.verses,
    start: pos,
    end: list.end,
  };
}

function parseRomanianChapter(
  text: string,
  pos: number,
  startsRun: boolean,
): ChapterSegment | null {
  // A run cannot start in the middle of `12:30:15`, `3.5:1` or a range.
  if (startsRun && /[:.,/\-\u2013]/.test(text[pos - 1] ?? '')) return null;
  const match = matchAt(RO_CHAPTER_COLON, text, pos);
  const digits = match?.[1];
  if (!match || digits === undefined) return null;
  const chapter = Number.parseInt(digits, 10);
  if (!validChapter(chapter)) return null;
  const list = parseVerseList(text, pos + match[0].length, TARGET_FOLLOWING);
  if (!list) return null;
  return { lead: 'chapter', chapter, verses: list.verses, start: pos, end: list.end };
}

function parseRomanianSegment(text: string, pos: number, startsRun: boolean): Segment | null {
  return (
    parseRomanianBook(text, pos) ??
    parseRomanianVerse(text, pos) ??
    parseRomanianChapter(text, pos, startsRun)
  );
}

// ---------------------------------------------------------------------------------------------
// Runs

interface Grammar {
  segment: (text: string, pos: number, startsRun: boolean) => Segment | null;
  joiners: readonly [RegExp, JoinerKind][];
}

const ENGLISH: Grammar = { segment: parseEnglishSegment, joiners: SOURCE_JOINERS };
const ROMANIAN: Grammar = { segment: parseRomanianSegment, joiners: TARGET_JOINERS };

interface ParsedRun {
  segments: Segment[];
  end: number;
}

function parseRunAt(text: string, pos: number, grammar: Grammar): ParsedRun | null {
  if (isWordChar(text[pos - 1]) || !isWordChar(text[pos])) return null;
  const first = grammar.segment(text, pos, true);
  if (!first) return null;
  const segments: Segment[] = [first];
  let end = first.end;
  for (;;) {
    const joiner = matchJoiner(grammar.joiners, text, end);
    if (!joiner) break;
    const next = grammar.segment(text, joiner.end, false);
    if (!next || !ALLOWED_LEADS[joiner.kind].has(next.lead)) break;
    next.joiner = joiner.kind;
    segments.push(next);
    end = next.end;
  }
  return { segments, end };
}

function nextState(
  segment: Segment,
  current: Resolved | null,
  startsRun: boolean,
): Resolved | null {
  switch (segment.lead) {
    case 'book':
      return { book: segment.book, chapter: segment.chapter };
    case 'chapter':
      return { book: startsRun ? null : (current?.book ?? null), chapter: segment.chapter };
    case 'verse':
      return current;
  }
}

function verseText(verse: VerseItem): string {
  return `${verse.from}${verse.to === undefined ? '' : `-${verse.to}`}${verse.following ? 'ff' : ''}`;
}

function canonicalItem(state: Resolved | null, verse: string): string {
  if (state === null) return `vs ${verse}`;
  const { book, chapter } = state;
  if (book?.singleChapter) return `${book.code} ${verse}`;
  if (chapter === null) return `vs ${verse}`;
  return book ? `${book.code} ${chapter}:${verse}` : `${chapter}:${verse}`;
}

function segmentItems(segment: Segment, state: Resolved | null): string[] {
  if (segment.verses.length > 0) {
    return segment.verses.map((verse) => canonicalItem(state, verseText(verse)));
  }
  // A named chapter: `Matt 13`.
  return state?.book && state.chapter !== null ? [`${state.book.code} ${state.chapter}`] : [];
}

/** Canonical items of a run and the state a following `vs.` inherits. */
function resolveRun(
  segments: readonly Segment[],
  previous: Resolved | null,
): { canonical: string[]; last: Resolved | null } {
  let current = previous;
  const canonical: string[] = [];
  segments.forEach((segment, index) => {
    current = nextState(segment, current, index === 0);
    canonical.push(...segmentItems(segment, current));
  });
  return { canonical, last: current };
}

// ---------------------------------------------------------------------------------------------
// Romanian rendering

const JOINER_RO: Record<JoinerKind, string> = {
  semicolon: '; ',
  comma: ', ',
  'comma-with': ', cu ',
  'comma-and': ', și ',
  with: ' cu ',
  and: ' și ',
};

function renderVerses(verses: readonly VerseItem[]): string {
  return verses
    .map((verse) => {
      const range = verse.to === undefined ? verse.from : `${verse.from}\u2013${verse.to}`;
      return verse.following ? `${range} ș.urm.` : range;
    })
    .join(', ');
}

function renderSegment(segment: Segment): string {
  const verses = renderVerses(segment.verses);
  switch (segment.lead) {
    case 'book': {
      if (segment.chapter === null) return `${segment.book.ro} ${verses}`;
      return verses === ''
        ? `${segment.book.ro} ${segment.chapter}`
        : `${segment.book.ro} ${segment.chapter}:${verses}`;
    }
    case 'chapter':
      return `${segment.chapter}:${verses}`;
    case 'verse': {
      const several =
        segment.plural || segment.verses.length > 1 || segment.verses.some((v) => v.to);
      return `${several ? 'vv.' : 'v.'} ${verses}`;
    }
  }
}

/** The run in Romanian notation: `In. 3:3, 5; 18:36`, `Mat. 18:23 ș.urm.`, `Obad. 21`. */
export function renderRomanian(run: { segments: readonly Segment[] }): string {
  return run.segments
    .map((segment) => (segment.joiner ? JOINER_RO[segment.joiner] : '') + renderSegment(segment))
    .join('');
}

// ---------------------------------------------------------------------------------------------
// Public API

/** All runs of references in English text, in order, with canonical items and Romanian form. */
export function parseSourceReferences(text: string): ReferenceRun[] {
  const runs: ReferenceRun[] = [];
  let previous: Resolved | null = null;
  let pos = 0;
  while (pos < text.length) {
    const parsed = parseRunAt(text, pos, ENGLISH);
    if (!parsed) {
      pos += 1;
      continue;
    }
    const { canonical, last } = resolveRun(parsed.segments, previous);
    previous = last;
    runs.push({
      start: pos,
      end: parsed.end,
      source: text.slice(pos, parsed.end),
      target: renderRomanian(parsed),
      canonical,
      segments: parsed.segments,
    });
    pos = parsed.end;
  }
  return runs;
}

/** All runs of references in Romanian notation, mapped to the same canonical items. */
export function extractTargetReferences(text: string): ExtractedReference[] {
  const runs: ExtractedReference[] = [];
  let previous: Resolved | null = null;
  let pos = 0;
  while (pos < text.length) {
    const parsed = parseRunAt(text, pos, ROMANIAN);
    if (!parsed) {
      pos += 1;
      continue;
    }
    const { canonical, last } = resolveRun(parsed.segments, previous);
    previous = last;
    runs.push({ start: pos, end: parsed.end, text: text.slice(pos, parsed.end), canonical });
    pos = parsed.end;
  }
  return runs;
}

/** Flat list of the canonical items of several runs. */
export function canonicalItems(runs: readonly { canonical: readonly string[] }[]): string[] {
  return runs.flatMap((run) => run.canonical);
}

export interface ReferenceDiff {
  /** Items of the source that the target does not have (multiset difference, source order). */
  missing: string[];
  /** Items of the target that the source does not have (multiset difference, target order). */
  extra: string[];
}

function surplus(items: readonly string[], other: readonly string[]): string[] {
  const available = new Map<string, number>();
  for (const item of other) available.set(item, (available.get(item) ?? 0) + 1);
  const result: string[] = [];
  for (const item of items) {
    const count = available.get(item) ?? 0;
    if (count > 0) available.set(item, count - 1);
    else result.push(item);
  }
  return result;
}

export function compareReferences(
  sourceItems: readonly string[],
  targetItems: readonly string[],
): ReferenceDiff {
  return { missing: surplus(sourceItems, targetItems), extra: surplus(targetItems, sourceItems) };
}

// ---------------------------------------------------------------------------------------------
// Diagnostics

const ENGLISH_WITH_ARABIC = new RegExp(
  String.raw`(?<![A-Za-z0-9])(?<token>(?:[123]\s?)?(?:${ENGLISH_BOOK_PATTERN})(?![A-Za-z])\.?)\s*\d{1,3}(?!\d)(?:\s*[:.]\s*\d{1,3}(?:\s*[-\u2013]\s*\d{1,3})?)?`,
  'g',
);

interface Span {
  start: number;
  end: number;
}

/** Sorted spans without those that start inside an earlier one. */
function outermost(spans: readonly Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const span of sorted) {
    const last = kept[kept.length - 1];
    if (!last || span.start >= last.end) kept.push(span);
  }
  return kept;
}

/**
 * Fragments of a Romanian text that are scripture references in some other notation: roman
 * numerals, English abbreviations (`Matt.`, `Jno.`, `Mk.`), `vs.`. Used by REF_FORMAT.
 */
export function detectNonRomanianNotation(text: string): string[] {
  const candidates: Span[] = parseSourceReferences(text).map((run) => ({
    start: run.start,
    end: run.end,
  }));
  for (const match of text.matchAll(ENGLISH_WITH_ARABIC)) {
    const token = match.groups?.token ?? '';
    const numbered = /^([123])\s?(.+)$/.exec(token);
    const book = numbered
      ? lookupEnglishBook(numbered[1], (numbered[2] ?? '').replace(/\.$/, ''))
      : lookupEnglishBook(undefined, token.replace(/\.$/, ''));
    if (!book || sameRomanianAbbreviation(token, book)) continue;
    candidates.push({ start: match.index, end: match.index + match[0].length });
  }
  // `v. 5` and `Obad. 21` are valid Romanian even though the English grammar reads them too.
  const romanian = extractTargetReferences(text);
  const foreign = candidates.filter(
    (c) => !romanian.some((r) => r.start <= c.start && c.end <= r.end),
  );
  return outermost(foreign).map((span) => text.slice(span.start, span.end));
}

export interface UnparsedFragment {
  index: number;
  /** The reference-like fragment with a little of what follows it. */
  text: string;
}

const LOOSE_PATTERNS: readonly RegExp[] = [
  // roman numeral, period, number: `iv. 17`
  /(?<![A-Za-z0-9])[ivxlc]{1,8}\.\s*\d/g,
  // a book name followed by a numeral or a number: `Matt. xiii`, `Rom. 5`
  new RegExp(
    String.raw`(?<![A-Za-z0-9])(?:[123]\s?)?(?:${ENGLISH_BOOK_PATTERN})(?![A-Za-z])\.?\s*(?:[ivxlcIVXLC]{1,8}(?![A-Za-z0-9])|\d)`,
    'g',
  ),
  // verse markers: `vs. 23`
  /(?<![A-Za-z0-9])(?:vss?|vers?|vv)\.\s*\d/gi,
];

/**
 * Reference-like fragments of `text` that `parseSourceReferences` did not turn into a run, plus
 * numbers that follow a run after white space only (a run cut short).
 */
export function findUnparsedReferenceFragments(
  text: string,
  runs: readonly Span[] = parseSourceReferences(text),
): UnparsedFragment[] {
  const covered = (index: number): boolean => runs.some((r) => index >= r.start && index < r.end);
  const found: Span[] = [];
  for (const pattern of LOOSE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (!covered(match.index)) {
        found.push({ start: match.index, end: match.index + match[0].length });
      }
    }
  }
  for (const run of runs) {
    const rest = /^\s+(?=\d)/.exec(text.slice(run.end));
    if (rest) found.push({ start: run.end + rest[0].length, end: run.end + rest[0].length + 1 });
  }
  // One malformed reference matches several loose patterns: report it once.
  return outermost(found).map((span) => ({
    index: span.start,
    text: text.slice(span.start, span.start + 40),
  }));
}
