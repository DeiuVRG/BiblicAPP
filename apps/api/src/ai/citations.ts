import type { PromptSource } from '../ask/sources';
import { foldText, normaliseInput } from '../text/fold';
import type { Citation } from '../types';

// The model cites with "[1]", "[2][4]", "[1, 3]" or "[2-4]": the numbers index the sources of the
// request. This module finds those markers in a stream of text deltas, however the deltas cut
// them, and ties each one to the sentence it supports.

const MARKER = /\[(\d{1,3}(?:\s*[,;–—-]\s*\d{1,3})*)\]/g;
/** A tail that could still become a marker: "[", "[1", "[1,", "[1, 2". */
const MARKER_PREFIX = /^\[[\d\s,;–—-]*$/;
/**
 * How far back from the end an unfinished marker may start and still be waited for. The longest
 * sensible marker, "[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]", is 31 characters; a bracket further back than
 * this is not a marker that is still arriving, and text behind it is never held up.
 */
const MAX_MARKER_CHARS = 120;
const MAX_CLAIM_CHARS = 300;
const MAX_RANGE = 10;

/**
 * The source numbers inside a marker body: "1, 3" -> [1, 3]; "2-4" -> [2, 3, 4]. `unusable` counts
 * the parts that name no source at all: a range that runs backwards ("3-1") or is absurdly long
 * ("1-100"), or a chain of dashes ("1-2-3").
 */
function parseBody(body: string): { numbers: number[]; unusable: number } {
  const numbers: number[] = [];
  let unusable = 0;
  const parts = body.split(/\s*[,;]\s*/);
  for (const part of parts) {
    const range = /^(\d{1,3})\s*[–—-]\s*(\d{1,3})$/.exec(part);
    if (range !== null) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to >= from && to - from < MAX_RANGE) for (let n = from; n <= to; n += 1) numbers.push(n);
      else unusable += 1;
      continue;
    }
    const single = /^\d{1,3}$/.exec(part);
    if (single !== null) numbers.push(Number(part));
    else unusable += 1;
  }
  return { numbers, unusable };
}

/** Removes `[n]` markers (history cleanup, claim text). */
export function stripMarkers(text: string): string {
  return text.replace(MARKER, '').replace(/[ \t]{2,}/g, ' ');
}

export class CitationTracker {
  private text = '';
  private scanned = 0;
  private lastClaim = '';
  /** Valid citations found so far, in order of appearance. */
  readonly citations: Citation[] = [];
  /** Markers (or parts of one) that pointed outside `1..sourceCount` or named no source. */
  invalidMarkers = 0;

  constructor(private readonly sourceCount: number) {}

  get answer(): string {
    return this.text;
  }

  /** Appends a delta and returns the citations it completed. */
  push(delta: string): Citation[] {
    this.text += delta;
    const limit = this.incompleteTailStart();
    const found: Citation[] = [];
    // A fresh regex: `claimBefore` runs `replace` with MARKER, which resets MARKER.lastIndex.
    const markers = new RegExp(MARKER.source, 'g');
    markers.lastIndex = this.scanned;
    for (let match = markers.exec(this.text); match !== null; match = markers.exec(this.text)) {
      if (match.index + match[0].length > limit) break;
      const claim = this.claimBefore(match.index);
      const body = parseBody(match[1] as string);
      this.invalidMarkers += body.unusable;
      for (const sourceIndex of body.numbers) {
        if (sourceIndex < 1 || sourceIndex > this.sourceCount) {
          this.invalidMarkers += 1;
          continue;
        }
        found.push({ sourceIndex, text: claim, offset: match.index });
      }
    }
    this.scanned = limit;
    this.citations.push(...found);
    return found;
  }

  /** Start of an unfinished marker at the end of the text, or the text length when there is none. */
  private incompleteTailStart(): number {
    const tail = this.text.slice(-MAX_MARKER_CHARS);
    const open = tail.lastIndexOf('[');
    if (open === -1) return this.text.length;
    const candidate = tail.slice(open);
    if (!MARKER_PREFIX.test(candidate)) return this.text.length;
    return this.text.length - candidate.length;
  }

  /** The sentence or clause that ends at the marker: the text since the previous sentence end. */
  private claimBefore(markerStart: number): string {
    const before = stripMarkers(
      this.text.slice(Math.max(0, markerStart - 800), markerStart),
    ).trimEnd();
    const body = before.replace(/[.!?;:…]+$/u, '').trimEnd();
    let cut = -1;
    for (const separator of ['. ', '! ', '? ', '\n', '; '])
      cut = Math.max(cut, body.lastIndexOf(separator));
    const claim = body.slice(cut + 1).trim();
    if (claim === '') return this.lastClaim;
    this.lastClaim = claim.length > MAX_CLAIM_CHARS ? claim.slice(-MAX_CLAIM_CHARS) : claim;
    return this.lastClaim;
  }
}

/** All the citations of a finished answer. */
export function findCitations(
  answer: string,
  sourceCount: number,
): {
  citations: Citation[];
  invalidMarkers: number;
} {
  const tracker = new CitationTracker(sourceCount);
  tracker.push(answer);
  return { citations: tracker.citations, invalidMarkers: tracker.invalidMarkers };
}

// ---------------------------------------------------------------------------------------------
// Quotations

const QUOTE_PAIRS: ReadonlyArray<[string, string]> = [
  ['„', '”'], // „ ”
  ['“', '”'], // “ ”
  ['«', '»'], // « »
  ['"', '"'],
];
/** Quotations shorter than this are terms, not quotations. */
const MIN_QUOTE_CHARS = 20;
const MIN_FRAGMENT_CHARS = 12;

function squash(text: string): string {
  return foldText(normaliseInput(text))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A quotation found in an answer: where its quotation marks are and the text between them. */
export interface QuoteSpan {
  /** Position of the opening quotation mark (UTF-16 offset in the answer). */
  start: number;
  /** Position of the closing quotation mark. */
  end: number;
  text: string;
}

/** The quotations of an answer (text between quotation marks), in order of appearance. */
export function findQuotations(answer: string): QuoteSpan[] {
  const found: QuoteSpan[] = [];
  for (const [open, close] of QUOTE_PAIRS) {
    let from = 0;
    for (;;) {
      const start = answer.indexOf(open, from);
      if (start === -1) break;
      const end = answer.indexOf(close, start + 1);
      if (end === -1) break;
      found.push({ start, end, text: answer.slice(start + 1, end) });
      from = end + 1;
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** The text between quotation marks, in order of appearance. */
export function extractQuotations(answer: string): string[] {
  return findQuotations(answer).map((quote) => quote.text);
}

export interface QuoteCheck {
  checked: number;
  /** Quotations that are not word for word in any source the model was given. */
  unverified: string[];
}

/** The folded texts a quotation may come from: the version shown of a source and, for a translation, its original. */
function haystacksOf(entry: PromptSource): string[] {
  const texts = [squash(entry.text)];
  if (entry.original !== undefined) texts.push(squash(entry.original.text));
  return texts;
}

/**
 * Whether every piece of the quotation (it is split at ellipses, and pieces shorter than
 * `MIN_FRAGMENT_CHARS` are ignored) occurs word for word, modulo case, diacritics and punctuation,
 * in one of the texts.
 */
function isQuoted(quote: string, haystacks: readonly string[]): boolean {
  const fragments = quote
    .split(/…|\.{3}/)
    .map(squash)
    .filter((fragment) => fragment.length >= MIN_FRAGMENT_CHARS);
  return (
    fragments.length > 0 &&
    fragments.every((fragment) => haystacks.some((text) => text.includes(fragment)))
  );
}

/**
 * "Never invent quotations": every quotation in the answer (long enough to be one) must occur,
 * word for word modulo case, diacritics and punctuation, in a version of *some* source. Quotations
 * with an ellipsis are checked piece by piece. `verifyQuotationsByCitation` is the stricter check
 * the gateway runs; this one is its fallback for a quotation whose sentence cites nothing.
 */
export function verifyQuotations(answer: string, sources: readonly PromptSource[]): QuoteCheck {
  const haystacks = sources.flatMap(haystacksOf);
  let checked = 0;
  const unverified: string[] = [];
  for (const quote of extractQuotations(stripMarkers(answer))) {
    if (quote.trim().length < MIN_QUOTE_CHARS) continue;
    checked += 1;
    if (!isQuoted(quote, haystacks)) unverified.push(quote.trim().slice(0, 200));
  }
  return { checked, unverified };
}

// ---------------------------------------------------------------------------------------------
// Quotations checked against the sources their sentence cites

const SENTENCE_END = new Set(['.', '!', '?', '…']);
/** A marker right after a full stop belongs to the sentence that stop ends: "Works follow. [2]". */
const TRAILING_MARKER = /^\s*\[\d{1,3}(?:\s*[,;–—-]\s*\d{1,3})*\]/;
/** Words after which a full stop is not the end of a sentence ("St. Paul", "cf. Matt."). */
const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'st',
  'sf',
  'dr',
  'mr',
  'mrs',
  'ms',
  'prof',
  'vs',
  'cf',
  'vol',
  'ch',
  'cap',
  'ed',
  'pp',
  'op',
  'loc',
  'ibid',
  'nr',
  'art',
  'fig',
  'no',
]);
/** Stands in for the characters of a quotation while the sentences are found. */
const MASK = '\u0001';

export interface Sentence {
  /** Position of the first character in the answer. */
  start: number;
  /** Position after the last character (trailing citation markers included). */
  end: number;
}

function wordBefore(chars: readonly string[], index: number): string {
  let from = index;
  while (from > 0 && /\p{L}/u.test(chars[from - 1] as string)) from -= 1;
  return chars.slice(from, index).join('');
}

/**
 * Cuts an answer into sentences: after `.`, `!`, `?` or `…` followed by a space and the start of
 * the next one (a capital letter, a digit, a quotation mark), and at line breaks. What stands
 * between quotation marks never ends a sentence, so a quotation of several sentences stays whole;
 * a quotation that ends with its own full stop ends the sentence there. A full stop does not end
 * a sentence after a known abbreviation or an initial ("St. Paul", "G. Vos", "e.g."), before a
 * lower-case letter, or between a word and a number ("Matt. 4:17"). Citation markers that follow
 * the stop ("... follow. [2]") stay with the sentence they cite. It is a heuristic with a safe
 * failure: a wrong cut can only separate a quotation from the marker that cites it, and a
 * quotation with no marker in its sentence is checked against every source.
 */
export function splitSentences(
  answer: string,
  quotes: readonly QuoteSpan[] = findQuotations(answer),
): Sentence[] {
  const chars = answer.split('');
  for (const quote of quotes) {
    for (let at = quote.start; at <= quote.end; at += 1) chars[at] = MASK;
    if (quote.end > quote.start + 1 && SENTENCE_END.has(answer.charAt(quote.end - 1))) {
      chars[quote.end] = '.';
    }
  }
  const length = chars.length;
  const sentences: Sentence[] = [];
  let start = 0;
  const close = (end: number): void => {
    if (answer.slice(start, end).trim() !== '') sentences.push({ start, end });
    start = end;
  };
  let i = 0;
  while (i < length) {
    const char = chars[i] as string;
    if (char === '\n') {
      close(i + 1);
      i += 1;
      continue;
    }
    if (!SENTENCE_END.has(char)) {
      i += 1;
      continue;
    }
    let stop = i + 1;
    while (stop < length && SENTENCE_END.has(chars[stop] as string)) stop += 1;
    while (stop < length && chars[stop] === ')') stop += 1;
    let end = stop;
    for (
      let marker = TRAILING_MARKER.exec(answer.slice(end));
      marker !== null;
      marker = TRAILING_MARKER.exec(answer.slice(end))
    ) {
      end += marker[0].length;
    }
    let next = end;
    while (next < length && /\s/.test(chars[next] as string)) next += 1;
    if (next >= length) break; // the rest of the answer is one sentence
    if (next === end) {
      i = stop; // no space after the stop: "3.14"
      continue;
    }
    const following = chars[next] as string;
    const continues = following !== following.toUpperCase(); // a lower-case letter
    const word = char === '.' && stop === i + 1 ? wordBefore(chars, i) : '';
    const dotted = ['e.g', 'i.e'].includes(
      chars
        .slice(Math.max(0, i - 3), i)
        .join('')
        .toLowerCase(),
    );
    const abbreviation =
      dotted ||
      (word !== '' &&
        (ABBREVIATIONS.has(word.toLowerCase()) ||
          (word.length === 1 && word === word.toUpperCase())));
    const reference = char === '.' && /\d/.test(following) && /\p{L}/u.test(chars[i - 1] ?? '');
    if (continues || abbreviation || reference) {
      i = stop;
      continue;
    }
    close(end);
    i = end;
  }
  close(length);
  return sentences;
}

/** The citation markers of an answer with the sources they name (only numbers inside `1..sourceCount`). */
function findMarkers(
  answer: string,
  sourceCount: number,
): Array<{ at: number; numbers: number[] }> {
  const found: Array<{ at: number; numbers: number[] }> = [];
  for (const match of answer.matchAll(new RegExp(MARKER.source, 'g'))) {
    const numbers = parseBody(match[1] as string).numbers.filter(
      (number) => number >= 1 && number <= sourceCount,
    );
    found.push({ at: match.index ?? 0, numbers });
  }
  return found;
}

export interface UnverifiedQuotation {
  /** The quoted text (at most 200 characters), markers removed. */
  text: string;
  /** Index, from 0, of the sentence of the answer that holds the quotation (`splitSentences`). */
  sentence: number;
  /** Position of the opening quotation mark in the answer (UTF-16 offset, like `Citation.offset`). */
  offset: number;
  /** The numbers of the sources it was checked against; empty when it was checked against all of them. */
  cited: number[];
}

export interface CitedQuoteCheck {
  /** Quotations long enough to be checked (shorter ones are terms, not quotations). */
  checked: number;
  /** Of those, the ones whose sentence cites no source, so that they were checked against all. */
  uncited: number;
  unverified: UnverifiedQuotation[];
}

/**
 * Checks every quotation against the sources the sentence that holds it cites (all the valid
 * markers of that sentence, together), not against every source of the request: a model that
 * quotes one passage and cites another is caught. A sentence that cites no valid source falls
 * back to all sources, as `verifyQuotations` does.
 */
export function verifyQuotationsByCitation(
  answer: string,
  sources: readonly PromptSource[],
): CitedQuoteCheck {
  const result: CitedQuoteCheck = { checked: 0, uncited: 0, unverified: [] };
  const quotes = findQuotations(answer);
  if (quotes.length === 0) return result;
  const perSource = sources.map(haystacksOf);
  const everything = perSource.flat();
  const sentences = splitSentences(answer, quotes);
  const markers = findMarkers(answer, sources.length);
  for (const quote of quotes) {
    const text = stripMarkers(quote.text).trim();
    if (text.length < MIN_QUOTE_CHARS) continue;
    result.checked += 1;
    let index = sentences.findIndex(
      (sentence) => quote.start >= sentence.start && quote.start < sentence.end,
    );
    if (index === -1)
      index = Math.max(0, sentences.filter((s) => s.start <= quote.start).length - 1);
    const sentence = sentences[index];
    const cited =
      sentence === undefined
        ? []
        : [
            ...new Set(
              markers
                .filter((marker) => marker.at >= sentence.start && marker.at < sentence.end)
                .flatMap((marker) => marker.numbers),
            ),
          ].sort((a, b) => a - b);
    if (cited.length === 0) result.uncited += 1;
    const haystacks = cited.length > 0 ? cited.flatMap((n) => perSource[n - 1] ?? []) : everything;
    if (!isQuoted(text, haystacks)) {
      result.unverified.push({
        text: text.slice(0, 200),
        sentence: index,
        offset: quote.start,
        cited,
      });
    }
  }
  return result;
}
