import { LATIN_BOOK_PATTERN, lookupLatinBook } from './books';
import {
  DIGIT,
  matchAt,
  parseRoman,
  parseVerseList,
  probeList,
  skipSpaces,
  sticky,
  validChapter,
} from './references';
import type {
  BookSegment,
  ChapterSegment,
  Grammar,
  JoinerKind,
  ListGrammar,
  Resolved,
  Segment,
  VerseList,
  VerseSegment,
} from './references';

/**
 * The notation of scripture references in Latin works (docs/traducere-pipeline.md, section 5.3):
 *
 * - `Matth. IV, 17`, `Ioh. 3, 5`, `Rom. v. 12`, `Ps. 118, 2`, `I Cor. xv, 22`, `1 Cor. 15, 22`:
 *   the book (the number of a numbered book in roman or arabic numerals), the chapter in roman or
 *   arabic numerals, a comma, a period or a colon, the verses. Verses are separated by a comma,
 *   by `. ` before a number, or by `et`; `-` makes a range; `sq.`, `sqq.`, `seq.`, `ff.` (with or
 *   without `et`) mean "and the following" and are kept as `ff`.
 * - `; 8, 3` and `; viii, 3` continue a run with a chapter of the same book; `v. 14` and
 *   `vv. 14-16` are verses of the chapter before; `ibid. 14` the same, `ibid. 6, 3` and
 *   `ibid. vi, 3` another chapter of the same book. A bare chapter cannot start a run.
 * - The Vulgate numbers the psalms and the books of Kings and Esdras differently from the Hebrew
 *   Bible: the canonical item keeps the number of the source and is marked `vulgate`, and the run
 *   carries a note for the translator (see `books.ts`).
 *
 * Reading is deliberately strict: an abbreviation is a book only when a chapter or verses follow.
 */

const ROMAN_PREFIX: Readonly<Record<string, string>> = { I: '1', II: '2', III: '3', IV: '4' };

const LA_BOOK = sticky(
  String.raw`(?<![\p{L}\p{N}])(?:([1-4])\.?\s?|(IV|III|II|I)\.?\s)?(${LATIN_BOOK_PATTERN})(?![\p{L}])(\.?)`,
  'u',
);
/** A chapter: arabic (group 1) or roman (group 2). */
const LA_CHAPTER = sticky(
  String.raw`(?:(\d{1,3})(?![A-Za-z0-9])|([ivxlcIVXLC]{1,8})(?![A-Za-z0-9]))`,
);
/** Between a roman chapter and its verses: `IV, 17` or `v. 12` or `v: 12`. */
const LA_SEPARATOR_ROMAN = sticky(String.raw`\s*[.,:]\s*`);
/** Between an arabic chapter and its verses: `3, 5` or `3:5` or `3.5`. */
const LA_SEPARATOR_ARABIC = sticky(String.raw`\s*(?:[,:]\s*|\.(?=\d))`);
const LA_CHAPTER_COLON = sticky(String.raw`(\d{1,3})\s*:\s*(?=\d)`);
const LA_VERSE_MARKER = sticky(String.raw`(?<![\p{L}\p{N}])(vv?|vss?|vers|versic)\.\s*(?=\d)`, 'u');
const LA_IBID = sticky(String.raw`(?<![\p{L}\p{N}])(?:ibidem|ibid|ib)(?![\p{L}])\.?\s*`, 'iu');
/** What may follow a chapter named without verses: the end of a citation. */
const LA_BOUNDARY = sticky(String.raw`\s*(?:[;,.:)\]”’"]|$)`);

/** The word `cap.` or `c.` between a book and its chapter: `Ioh. c. 3, 5`. */
const LA_CHAPTER_LABEL = sticky(String.raw`(?:cap|c)\.\s*(?=[\dIVXLCivxlc])`);
/** `v.` between the separator and the verses: `Ioh. 3, v. 5`. */
const LA_VERSE_LABEL = sticky(String.raw`(?:vv?|vss?|vers)\.\s*(?=\d)`);

const LA_FOLLOWING = sticky(String.raw`\s*(?:et\s+)?(?:sqq?|seqq?|ff?|ss)(?![A-Za-z0-9])\.?`);
/**
 * Verses of a list: `5, 8`, `5. 8` (a period before a number), `5 et 8`, `5 & 8`. After `et` a
 * number that is itself followed by a comma and a number is a chapter (`5, 3 et 6, 1`), not a verse.
 */
const LA_VERSE_SEPARATOR = sticky(
  String.raw`\s*(?:,\s*|\.\s+(?=\d)|&\s*|\s+et\s+(?=\d)(?!\d{1,3}\s*[,:]\s*\d))`,
);

const LA_LISTS: ListGrammar = {
  following: LA_FOLLOWING,
  separator: LA_VERSE_SEPARATOR,
  startsBook: (text, pos) =>
    /[1-4]/.test(text.charAt(pos)) && parseLatinBook(text, pos, true) !== null,
};

export const LATIN_JOINERS: readonly [RegExp, JoinerKind][] = [
  [sticky(String.raw`\s*;\s*`), 'semicolon'],
  [sticky(String.raw`\s*,\s*cum\s+`), 'comma-with'],
  [sticky(String.raw`\s*,\s*et\s+`), 'comma-and'],
  [sticky(String.raw`\s*,\s*`), 'comma'],
  [sticky(String.raw`\s+cum\s+`), 'with'],
  [sticky(String.raw`\s+et\s+`), 'and'],
];

interface ChapterToken {
  chapter: number;
  arabic: boolean;
  /** The numeral as written (roman) or the digits. */
  token: string;
  end: number;
}

function chapterAt(text: string, pos: number): ChapterToken | null {
  const match = matchAt(LA_CHAPTER, text, pos);
  if (!match) return null;
  const arabic = match[1];
  const roman = match[2];
  const chapter = arabic !== undefined ? Number.parseInt(arabic, 10) : parseRoman(roman ?? '');
  if (chapter === null || !validChapter(chapter)) return null;
  return {
    chapter,
    arabic: arabic !== undefined,
    token: arabic ?? roman ?? '',
    end: pos + match[0].length,
  };
}

/** The verses after a chapter and its separator, when there are any. */
function versesAfterChapter(
  text: string,
  chapter: ChapterToken,
  probe: boolean,
): { list: VerseList | null; malformed: boolean } {
  const separator = matchAt(
    chapter.arabic ? LA_SEPARATOR_ARABIC : LA_SEPARATOR_ROMAN,
    text,
    chapter.end,
  );
  if (!separator) return { list: null, malformed: false };
  const labelled = chapter.end + separator[0].length;
  const at = labelled + (matchAt(LA_VERSE_LABEL, text, labelled)?.[0].length ?? 0);
  const list = probe ? probeList(text, at) : parseVerseList(text, at, LA_LISTS);
  // Digits after the separator that are not a verse list: malformed, do not guess.
  return { list, malformed: list === null && matchAt(DIGIT, text, at) !== null };
}

/** The chapter of a citation without verses (`Matth. V`) must end the citation and look the part. */
function chapterOnlyAllowed(
  text: string,
  chapter: ChapterToken,
  name: string,
  hasPeriod: boolean,
): boolean {
  if (!matchAt(LA_BOUNDARY, text, chapter.end)) return false;
  return chapter.arabic ? hasPeriod || name.length >= 4 : hasPeriod || chapter.token.length >= 2;
}

function parseLatinBook(text: string, pos: number, probe = false): BookSegment | null {
  const match = matchAt(LA_BOOK, text, pos);
  if (!match) return null;
  const number = match[1] ?? ROMAN_PREFIX[match[2] ?? ''];
  const name = match[3] ?? '';
  const found = lookupLatinBook(number, name);
  if (!found) return null;
  const { book } = found;
  const hasPeriod = match[4] === '.';
  const afterBook = skipSpaces(text, pos + match[0].length);
  const segment = (chapter: number | null, list: VerseList | null, end: number): BookSegment => {
    const result: BookSegment = {
      lead: 'book',
      book,
      chapter,
      verses: list ? list.verses : [],
      start: pos,
      end,
    };
    if (found.vulgate) result.vulgate = true;
    if (found.note !== undefined) result.note = found.note;
    return result;
  };

  if (book.singleChapter) {
    // `Iud. 5`, `Abd. 21`; `Abd. 1:21` (with a colon) means the same.
    const colon = matchAt(LA_CHAPTER_COLON, text, afterBook);
    if (colon && Number.parseInt(colon[1] ?? '', 10) !== 1) return null;
    const at = colon ? afterBook + colon[0].length : afterBook;
    const list = probe ? probeList(text, at) : parseVerseList(text, at, LA_LISTS);
    return list ? segment(null, list, list.end) : null;
  }

  const label = matchAt(LA_CHAPTER_LABEL, text, afterBook);
  const chapter = chapterAt(text, afterBook + (label?.[0].length ?? 0));
  if (!chapter) return null;
  const { list, malformed } = versesAfterChapter(text, chapter, probe);
  if (list) return segment(chapter.chapter, list, list.end);
  if (malformed) return null;
  if (!chapterOnlyAllowed(text, chapter, name, hasPeriod)) return null;
  return segment(chapter.chapter, null, chapter.end);
}

/** `ibid. 14` (verses of the chapter before), `ibid. 6, 3` and `ibid. vi, 3` (another chapter). */
function parseLatinIbid(text: string, pos: number): ChapterSegment | VerseSegment | null {
  const marker = matchAt(LA_IBID, text, pos);
  if (!marker) return null;
  const at = pos + marker[0].length;
  const chapter = chapterAt(text, at);
  if (chapter) {
    const { list } = versesAfterChapter(text, chapter, false);
    if (list) {
      return {
        lead: 'chapter',
        chapter: chapter.chapter,
        verses: list.verses,
        ibid: true,
        start: pos,
        end: list.end,
      };
    }
  }
  const list = parseVerseList(text, at, LA_LISTS);
  if (!list) return null;
  return {
    lead: 'verse',
    plural: false,
    verses: list.verses,
    ibid: true,
    start: pos,
    end: list.end,
  };
}

/** `v. 14`, `vv. 14-16`: verses of the book and chapter before. */
function parseLatinVerse(text: string, pos: number): VerseSegment | null {
  const marker = matchAt(LA_VERSE_MARKER, text, pos);
  if (!marker) return null;
  const list = parseVerseList(text, pos + marker[0].length, LA_LISTS);
  if (!list) return null;
  return {
    lead: 'verse',
    plural: /^(?:vv|vss)$/.test(marker[1] ?? ''),
    verses: list.verses,
    start: pos,
    end: list.end,
  };
}

/**
 * A chapter after `;` (`Matth. 5, 3; 6, 1`, `Rom. v. 12; vi. 3`). It needs verses, and a book
 * before it: a run cannot start with one. After a comma only a lower-case roman numeral qualifies,
 * since an arabic number there is the next verse of the list.
 */
function parseLatinChapter(
  text: string,
  pos: number,
  startsRun: boolean,
  strict: boolean,
): ChapterSegment | null {
  if (startsRun) return null;
  const chapter = chapterAt(text, pos);
  if (!chapter) return null;
  if (strict) {
    if (chapter.arabic) return null;
    if (chapter.token !== chapter.token.toLowerCase()) return null;
    if (chapter.token.length < 2 && !'ivx'.includes(chapter.token)) return null;
  }
  const { list } = versesAfterChapter(text, chapter, false);
  if (!list) return null;
  return {
    lead: 'chapter',
    chapter: chapter.chapter,
    verses: list.verses,
    start: pos,
    end: list.end,
  };
}

function parseLatinSegment(
  text: string,
  pos: number,
  startsRun: boolean,
  strict: boolean,
): Segment | null {
  return (
    parseLatinBook(text, pos) ??
    parseLatinIbid(text, pos) ??
    parseLatinVerse(text, pos) ??
    parseLatinChapter(text, pos, startsRun, strict)
  );
}

/**
 * `ibid.` at the start of a run takes the book (and, for verses only, the chapter) of the
 * reference before it, so that the translator is given a reference that can be read on its own.
 * Without an antecedent it stays as it is.
 */
function finishLatin(segments: Segment[], previous: Resolved | null): Segment[] {
  const first = segments[0];
  if (!first || first.lead === 'book' || first.ibid !== true || !previous?.book) return segments;
  const chapter = first.lead === 'chapter' ? first.chapter : previous.chapter;
  if (chapter === null && !previous.book.singleChapter) return segments;
  const resolved: BookSegment = {
    lead: 'book',
    book: previous.book,
    chapter: previous.book.singleChapter ? null : chapter,
    verses: first.verses,
    inherited: true,
    start: first.start,
    end: first.end,
  };
  if (previous.vulgate === true) resolved.vulgate = true;
  if (previous.note !== undefined) resolved.note = previous.note;
  return [resolved, ...segments.slice(1)];
}

export const LATIN: Grammar = {
  segment: parseLatinSegment,
  joiners: LATIN_JOINERS,
  finish: finishLatin,
};

// ---------------------------------------------------------------------------------------------
// Diagnostics

/** The roman numeral of a numbered book and the name of a book, as one pattern. */
const LATIN_BOOK_WITH_NUMBER = String.raw`(?:[1-4]\.?\s?|(?:IV|III|II|I)\.?\s)?(?:${LATIN_BOOK_PATTERN})(?![\p{L}])`;

/** Reference-like fragments of Latin text (see `findUnparsedFragments`). */
export const LATIN_LOOSE_PATTERNS: readonly RegExp[] = [
  // a roman numeral, a separator and a number: `iv, 17`, `v. 12`
  /(?<![\p{L}\p{N}])[ivxlcIVXLC]{1,8}[.,]\s*\d/gu,
  // a book name followed by a numeral or a number: `Matth. IV`, `Rom. 5`
  new RegExp(
    String.raw`(?<![\p{L}\p{N}])${LATIN_BOOK_WITH_NUMBER}\.?\s*(?:[ivxlcIVXLC]{1,8}(?![A-Za-z0-9])|\d)`,
    'gu',
  ),
  // verse markers: `v. 14`, `vv. 14-16`
  /(?<![\p{L}\p{N}])(?:vv?|vss?|vers|versic)\.\s*\d/gu,
  // `ibid.` followed by a number
  /(?<![\p{L}\p{N}])(?:ibidem|ibid|ib)(?![\p{L}])\.?\s*\d/giu,
];

/** What may stand between the end of a Latin run and a number it should have taken along. */
export const LATIN_CUT_SHORT = /^(?:\s*[,;&]\s*(?:et\s+)?|\s+et\s+|\s+)(?=\d)/;
