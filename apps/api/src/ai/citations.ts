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

/** The text between quotation marks, in order of appearance. */
export function extractQuotations(answer: string): string[] {
  const found: Array<{ start: number; text: string }> = [];
  for (const [open, close] of QUOTE_PAIRS) {
    let from = 0;
    for (;;) {
      const start = answer.indexOf(open, from);
      if (start === -1) break;
      const end = answer.indexOf(close, start + 1);
      if (end === -1) break;
      found.push({ start, text: answer.slice(start + 1, end) });
      from = end + 1;
    }
  }
  return found.sort((a, b) => a.start - b.start).map((quote) => quote.text);
}

export interface QuoteCheck {
  checked: number;
  /** Quotations that are not word for word in any source the model was given. */
  unverified: string[];
}

/**
 * "Never invent quotations": every quotation in the answer (long enough to be one) must occur,
 * word for word modulo case, diacritics and punctuation, in a version of a source. Quotations
 * with an ellipsis are checked piece by piece.
 */
export function verifyQuotations(answer: string, sources: readonly PromptSource[]): QuoteCheck {
  const haystacks = sources.flatMap((entry) => {
    const texts = [squash(entry.text)];
    if (entry.original !== undefined) texts.push(squash(entry.original.text));
    return texts;
  });
  let checked = 0;
  const unverified: string[] = [];
  for (const quote of extractQuotations(stripMarkers(answer))) {
    if (quote.trim().length < MIN_QUOTE_CHARS) continue;
    checked += 1;
    const fragments = quote
      .split(/…|\.{3}/)
      .map(squash)
      .filter((fragment) => fragment.length >= MIN_FRAGMENT_CHARS);
    const ok =
      fragments.length > 0 &&
      fragments.every((fragment) => haystacks.some((text) => text.includes(fragment)));
    if (!ok) unverified.push(quote.trim().slice(0, 200));
  }
  return { checked, unverified };
}
