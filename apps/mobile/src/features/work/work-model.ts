// What the work page derives from the packs: a word count and the round figure it shows.

/** The words of a text: runs of non-space characters (a hyphenated word and a number count as one). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * The figure of the CUVINTE tile: the count rounded to the hundred ("~29.600"). A short text is not
 * rounded to nothing: under a hundred words it is the count itself.
 */
export function roundedWords(words: number): number {
  return words < 100 ? words : Math.round(words / 100) * 100;
}
