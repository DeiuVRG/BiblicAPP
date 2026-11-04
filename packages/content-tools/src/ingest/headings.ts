import { collapse } from './text';

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** Converts an upper-case roman numeral to a number; returns null for invalid input. */
export function romanToInt(numeral: string): number | null {
  const text = numeral.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(text)) return null;
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    const value = ROMAN[text[i] as string] as number;
    const next = ROMAN[text[i + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

export interface ChapterMarker {
  /** The numeral as written, e.g. "IV". */
  number: string;
  value: number;
}

/**
 * Parses a chapter marker line such as `CHAPTER IV`. `pattern` must capture the numeral in
 * group 1. Returns null if the line is not a marker.
 */
export function parseChapterMarker(line: string, pattern: RegExp): ChapterMarker | null {
  const match = pattern.exec(line);
  const numeral = match?.[1];
  if (!numeral) return null;
  const value = romanToInt(numeral);
  return value === null ? null : { number: numeral.toUpperCase(), value };
}

/**
 * True for an ALL-CAPS heading line: at least two words and 4 letters, at most 90 characters,
 * at least 90% of the letters upper case, no sentence punctuation at the end.
 */
export function isAllCapsHeading(line: string): boolean {
  const text = collapse(line);
  if (text.length === 0 || text.length > 90) return false;
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 4) return false;
  if (text.split(' ').length < 2) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (upper / letters.length < 0.9) return false;
  return !/[.,;:]$/.test(text);
}
