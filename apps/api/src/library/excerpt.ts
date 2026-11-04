import { baseLanguage, getAnalyzer } from '../text/analyzer';
import { foldText } from '../text/fold';

export const DEFAULT_EXCERPT_CHARS = 480;

/**
 * A short piece of `text` for display. A paragraph that fits is returned whole; a longer one is
 * cut to a window around the first place where a query term occurs (or its start), at word
 * boundaries and with an ellipsis at each cut end.
 */
export function makeExcerpt(
  text: string,
  queryText: string,
  language: string,
  maxChars = DEFAULT_EXCERPT_CHARS,
): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;

  let anchor = 0;
  const stems = new Set(getAnalyzer(baseLanguage(language)).analyze(queryText));
  if (stems.size > 0) {
    const folded = foldText(clean);
    let best = -1;
    for (const word of folded.matchAll(/[\p{L}\p{N}]+/gu)) {
      const token = word[0];
      for (const stem of stems) {
        if (stem.length >= 3 && token.startsWith(stem)) {
          best = word.index ?? 0;
          break;
        }
      }
      if (best >= 0) break;
    }
    if (best >= 0) anchor = best;
  }

  let start = Math.max(0, anchor - Math.floor(maxChars / 4));
  if (start > 0) {
    const space = clean.indexOf(' ', start);
    start = space !== -1 && space < anchor ? space + 1 : start;
  }
  let end = Math.min(clean.length, start + maxChars);
  if (end < clean.length) {
    const space = clean.lastIndexOf(' ', end);
    if (space > start + maxChars * 0.6) end = space;
  }
  return `${start > 0 ? '… ' : ''}${clean.slice(start, end).trim()}${end < clean.length ? ' …' : ''}`;
}
