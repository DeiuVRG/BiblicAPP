import { indentOf } from './text';

/** One body line with the page it came from. */
export interface BodyLine {
  text: string;
  page: number;
}

export interface SegmentOptions {
  mode: 'auto' | 'layout' | 'length';
  indentMin: number;
  indentMax: number;
  /** `layout` mode: a line ending this many columns before the page's right edge ends a paragraph. */
  shortEndChars: number;
  shortLineRatio: number;
  /** Lower-case abbreviations whose trailing period does not end a sentence. */
  abbreviations?: readonly string[];
}

/**
 * A line that closes a sentence (period, question or exclamation mark, colon, semicolon).
 * A period after one of `abbreviations` ("vs.", "Mk.") does not close a sentence.
 */
export function endsSentence(
  text: string,
  abbreviations: ReadonlySet<string> = new Set(),
): boolean {
  if (!/[.?!:;]["'\u2019\u201D)\]]*\s*$/.test(text)) return false;
  const last = /(\p{L}+)\.\s*$/u.exec(text)?.[1];
  return !(last !== undefined && abbreviations.has(last.toLowerCase()));
}

/**
 * True if the line can open a paragraph: a capital letter, optionally behind an opening
 * quote/bracket and a few OCR garbage characters (an indent mark read as "=-" or "~").
 */
export function startsParagraph(text: string): boolean {
  return /^[\s=~*.,-]*["'\u2018\u201C\u00AB(\[]?\p{Lu}/u.test(text);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
}

/** Decides `layout` or `length` mode: layout is trusted if enough lines carry indentation. */
export function detectMode(
  lines: readonly BodyLine[],
  options: SegmentOptions,
): 'layout' | 'length' {
  if (options.mode !== 'auto') return options.mode;
  const margins = pageMargins(lines);
  const indented = lines.filter(
    (l) => indentOf(l.text) - (margins.get(l.page) ?? 0) >= options.indentMin,
  ).length;
  return indented >= 5 && indented / Math.max(1, lines.length) >= 0.01 ? 'layout' : 'length';
}

function pageMargins(lines: readonly BodyLine[]): Map<number, number> {
  const margins = new Map<number, number>();
  for (const line of lines) {
    if (line.text.trim() === '') continue;
    const indent = indentOf(line.text);
    const current = margins.get(line.page);
    if (current === undefined || indent < current) margins.set(line.page, indent);
  }
  return margins;
}

export interface SegmentResult {
  paragraphs: BodyLine[][];
  /** Indented lines that were NOT accepted as a paragraph start (previous line not terminated). */
  suspects: { page: number; text: string }[];
  mode: 'layout' | 'length';
}

/**
 * Splits the body lines of one chapter into paragraphs (arrays of lines). Blank lines are
 * ignored: in OCR text they are unreliable.
 */
export function segmentParagraphs(
  allLines: readonly BodyLine[],
  options: SegmentOptions,
): SegmentResult {
  const lines = allLines.filter((l) => l.text.trim() !== '');
  const mode = detectMode(lines, options);
  const margins = pageMargins(lines);

  // Right edge per page: where full lines end (85th percentile of line ends).
  const rightEdge = new Map<number, number>();
  const byPage = new Map<number, number[]>();
  for (const line of lines) {
    const list = byPage.get(line.page) ?? [];
    list.push(
      mode === 'layout' ? indentOf(line.text) + line.text.trim().length : line.text.trim().length,
    );
    byPage.set(line.page, list);
  }
  for (const [page, ends] of byPage)
    rightEdge.set(
      page,
      percentile(
        ends.sort((a, b) => a - b),
        0.85,
      ),
    );

  const abbreviations = new Set((options.abbreviations ?? []).map((a) => a.toLowerCase()));
  const paragraphs: BodyLine[][] = [];
  const suspects: { page: number; text: string }[] = [];
  let current: BodyLine[] = [];
  lines.forEach((line, index) => {
    const previous = index > 0 ? (lines[index - 1] as BodyLine) : undefined;
    let startsNew = previous === undefined;
    if (previous !== undefined) {
      const sentenceEnd = endsSentence(previous.text, abbreviations);
      const opener = startsParagraph(line.text);
      if (mode === 'layout') {
        const relative = indentOf(line.text) - (margins.get(line.page) ?? 0);
        const indentCue = relative >= options.indentMin && relative <= options.indentMax;
        const previousEnd = indentOf(previous.text) + previous.text.trim().length;
        const shortCue = previousEnd <= (rightEdge.get(previous.page) ?? 0) - options.shortEndChars;
        if (sentenceEnd && opener && (indentCue || shortCue)) startsNew = true;
        else if (indentCue) suspects.push({ page: line.page, text: line.text.trim() });
      } else {
        const width = rightEdge.get(previous.page) ?? 0;
        startsNew =
          sentenceEnd && opener && previous.text.trim().length < options.shortLineRatio * width;
      }
    }
    if (startsNew && current.length > 0) {
      paragraphs.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length > 0) paragraphs.push(current);
  return { paragraphs, suspects, mode };
}
