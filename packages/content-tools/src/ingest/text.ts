/** Basic text helpers shared by the ingest steps. */

/** Splits pdftotext output into pages (form feed separated). A trailing empty page is dropped. */
export function splitPages(raw: string): string[] {
  const normalised = raw.replace(/\r\n?/g, '\n').normalize('NFC');
  const pages = normalised.split('\f');
  if (pages.length > 1 && (pages[pages.length - 1] ?? '').trim() === '') pages.pop();
  return pages;
}

/** Number of leading spaces (tabs count as 4). */
export function indentOf(line: string): number {
  let indent = 0;
  for (const ch of line) {
    if (ch === ' ') indent += 1;
    else if (ch === '\t') indent += 4;
    else break;
  }
  return indent;
}

/** Collapses runs of whitespace into single spaces and trims. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Levenshtein distance (two-row dynamic programming). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] as number) + 1,
        (previous[j] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] as number;
}

/** Similarity in 0..1 based on the Levenshtein distance. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/** Sørensen–Dice coefficient over character bigrams. */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (text: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < text.length - 1; i += 1) {
      const gram = text.slice(i, i + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };
  const left = grams(a);
  const right = grams(b);
  let overlap = 0;
  for (const [gram, count] of left) overlap += Math.min(count, right.get(gram) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}
