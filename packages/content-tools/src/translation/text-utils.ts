/** Small text helpers shared by the translation modules. */

/** Whitespace-separated tokens, the unit of `--target-words` and of the word statistics. */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/** An exact substring of `text` around `index`, for quotes in findings (never offsets). */
export function excerpt(text: string, index: number, length = 80): string {
  const start = Math.max(0, index - Math.floor((length - 1) / 4));
  return text.slice(start, start + length);
}

/** The first `length` characters of `text`: an exact quote. */
export function head(text: string, length = 80): string {
  return text.slice(0, length);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `a, b and c` free list used in messages. */
export function joinList(items: readonly string[], limit = 8): string {
  if (items.length <= limit) return items.join(', ');
  return `${items.slice(0, limit).join(', ')} (+${items.length - limit} more)`;
}
