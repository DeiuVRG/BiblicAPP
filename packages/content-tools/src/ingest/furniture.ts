import { collapse, similarity } from './text';

/**
 * Page "furniture": running heads at the top of a page and page numbers / signature marks at the
 * bottom. Running heads are found by repetition: their text (page number removed) recurs on many
 * pages, with OCR noise, so texts are compared with a similarity measure, not for equality.
 */

/** Token made only of digits and common OCR look-alikes of digits (I, l, S, O) and dots. */
const NUMBER_TOKEN = /^[0-9ISlO.,]{1,5}$/;

/** Removes page-number-like tokens from both ends of a head line. */
export function stripPageNumber(line: string): string {
  const tokens = collapse(line).split(' ').filter(Boolean);
  while (tokens.length > 0 && NUMBER_TOKEN.test(tokens[0] as string)) tokens.shift();
  while (tokens.length > 0 && NUMBER_TOKEN.test(tokens[tokens.length - 1] as string)) tokens.pop();
  return tokens.join(' ');
}

/** True if the whole line is a page number (digits and look-alikes, possibly spaced). */
export function isBarePageNumber(line: string): boolean {
  const tokens = collapse(line).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.length <= 3 && tokens.every((t) => NUMBER_TOKEN.test(t));
}

/** Key used to compare head texts: lowercase letters only. */
export function headKey(line: string): string {
  return stripPageNumber(line)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export interface HeadModel {
  /** One representative key per detected running-head family. */
  families: { key: string; pages: number }[];
  similarity: number;
  /**
   * Difference between the raw page index (1-based) and the printed page number, when the printed
   * numbers form a clear sequence. A top line that carries the predicted number is a running head
   * even if its text is too garbled to match a family.
   */
  pageOffset: number | null;
}

/** One page of a text: its 1-based number in the raw file and its lines. */
export interface PageInput {
  page: number;
  lines: string[];
}

const DIGIT_LOOKALIKES: Record<string, string> = {
  I: '1',
  l: '1',
  '|': '1',
  O: '0',
  o: '0',
  S: '5',
  B: '8',
  Z: '2',
};

/** Reads an OCR-damaged page number ("I 10", "S2", "9S", "12.5") as an integer. */
export function parsePageNumber(text: string): number | null {
  const compact = text.replace(/[\s.,]/g, '');
  if (compact === '' || compact.length > 4 || !/^[0-9IlOoSBZ|]+$/.test(compact)) return null;
  const digits = [...compact].map((ch) => DIGIT_LOOKALIKES[ch] ?? ch).join('');
  return Number(digits);
}

/** Candidate page numbers read from the start and from the end of a line. */
export function edgeNumbers(line: string): number[] {
  const tokens = collapse(line).split(' ').filter(Boolean);
  const out: number[] = [];
  for (let n = 1; n <= 3 && n <= tokens.length; n += 1) {
    const head = parsePageNumber(tokens.slice(0, n).join(''));
    const tail = parsePageNumber(tokens.slice(tokens.length - n).join(''));
    if (head !== null) out.push(head);
    if (tail !== null) out.push(tail);
  }
  return out;
}

export interface DetectHeadsOptions {
  zoneLines: number;
  minRepeats: number;
  similarity: number;
}

function topLines(page: string[], count: number): string[] {
  return page.filter((line) => line.trim() !== '').slice(0, count);
}

/** Finds the page offset that most top lines agree on, or null if there is no clear winner. */
function estimateOffset(pages: PageInput[], zoneLines: number, minVotes: number): number | null {
  const votes = new Map<number, number>();
  for (const { page, lines } of pages) {
    const offsets = new Set<number>();
    for (const line of topLines(lines, zoneLines)) {
      for (const n of edgeNumbers(line)) offsets.add(page - n);
    }
    for (const offset of offsets) votes.set(offset, (votes.get(offset) ?? 0) + 1);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < minVotes * 3) return null;
  if (second && second[1] * 2 > best[1]) return null;
  return best[0];
}

/**
 * Detects running-head families from the top-of-page lines of `pages` (each page is an array of
 * lines). Pages that should not take part (chapter openings, front matter) must be left out.
 */
export function detectRunningHeads(pages: PageInput[], options: DetectHeadsOptions): HeadModel {
  const exact = new Map<string, number>();
  for (const { lines } of pages) {
    for (const line of topLines(lines, options.zoneLines)) {
      if (isBarePageNumber(line)) continue;
      const key = headKey(line);
      if (key.length < 3) continue;
      exact.set(key, (exact.get(key) ?? 0) + 1);
    }
  }
  // Greedy clustering: most frequent exact keys seed the families.
  const ordered = [...exact.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const families: { key: string; pages: number }[] = [];
  for (const [key, count] of ordered) {
    const family = families.find((f) => similarity(f.key, key) >= options.similarity);
    if (family) family.pages += count;
    else families.push({ key, pages: count });
  }
  return {
    families: families.filter((f) => f.pages >= options.minRepeats),
    similarity: options.similarity,
    pageOffset: estimateOffset(pages, options.zoneLines, options.minRepeats),
  };
}

/** True if `line` (top of raw page `page`) is a running head according to `model`. */
export function isRunningHead(line: string, model: HeadModel, page: number): boolean {
  if (model.pageOffset !== null && !isBarePageNumber(line)) {
    const predicted = page - model.pageOffset;
    if (edgeNumbers(line).includes(predicted) && headKey(line).length >= 3) return true;
  }
  const key = headKey(line);
  if (key.length < 3) return false;
  return model.families.some((family) => similarity(family.key, key) >= model.similarity);
}

export interface FurnitureOptions extends DetectHeadsOptions {
  extraPatterns: RegExp[];
  footZoneLines: number;
  footMaxChars: number;
}

export interface RemovedLine {
  where: 'head' | 'foot';
  text: string;
}

/** A short foot line without a real word: page number, signature mark or scan noise. */
export function isFootFurniture(line: string, maxChars: number): boolean {
  const text = collapse(line);
  if (text === '' || text.length > maxChars) return false;
  return !/[a-z]{2}/.test(text);
}

/**
 * Removes head and foot furniture from one page. Blank lines inside the page are kept.
 * `isOpening` pages (chapter openings) have no running head: only the foot is cleaned.
 */
export function stripFurniture(
  input: PageInput,
  model: HeadModel,
  options: FurnitureOptions,
  isOpening = false,
): { lines: string[]; removed: RemovedLine[] } {
  const lines = [...input.lines];
  const removed: RemovedLine[] = [];

  if (!isOpening) {
    const headIndexes: number[] = [];
    let seen = 0;
    for (let i = 0; i < lines.length && seen < options.zoneLines; i += 1) {
      const line = lines[i] as string;
      if (line.trim() === '') continue;
      seen += 1;
      const matchesExtra = options.extraPatterns.some((p) => p.test(line));
      if (matchesExtra || isRunningHead(line, model, input.page)) headIndexes.push(i);
    }
    if (headIndexes.length > 0) {
      // A bare page number next to a recognised head belongs to it ("10" / "Title").
      seen = 0;
      for (let i = 0; i < lines.length && seen < options.zoneLines; i += 1) {
        const line = lines[i] as string;
        if (line.trim() === '') continue;
        seen += 1;
        if (isBarePageNumber(line) && !headIndexes.includes(i)) headIndexes.push(i);
      }
    }
    for (const index of headIndexes.sort((a, b) => b - a)) {
      removed.push({ where: 'head', text: collapse(lines[index] as string) });
      lines.splice(index, 1);
    }
  }

  for (let n = 0; n < options.footZoneLines; n += 1) {
    let last = lines.length - 1;
    while (last >= 0 && (lines[last] as string).trim() === '') last -= 1;
    if (last < 0) break;
    const line = lines[last] as string;
    if (!isFootFurniture(line, options.footMaxChars)) break;
    removed.push({ where: 'foot', text: collapse(line) });
    lines.splice(last, 1);
  }

  return { lines, removed };
}
