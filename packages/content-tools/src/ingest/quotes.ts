/**
 * Typographic quotes for OCR text that uses straight quotes with unreliable spacing.
 *
 * Double quotes are resolved per paragraph by parity (open, close, open, close ...) when the
 * count is even; otherwise by the surrounding characters. Spacing around them is normalised.
 */

const DOUBLE = /["“”«»]/g;
const OPENERS_BEFORE = /[\s([—‘“-]/;

export function typographicQuotes(input: string): string {
  let text = input;

  const matches = [...text.matchAll(DOUBLE)];
  if (matches.length > 0) {
    const parity = matches.length % 2 === 0;
    let out = '';
    let last = 0;
    matches.forEach((match, n) => {
      const index = match.index as number;
      out += text.slice(last, index);
      const before = index === 0 ? '' : (text[index - 1] as string);
      const open = parity ? n % 2 === 0 : before === '' || OPENERS_BEFORE.test(before);
      out += open ? '“' : '”';
      last = index + 1;
    });
    out += text.slice(last);
    text = out;

    // Spacing: no space after an opening quote or before a closing one; a space is required
    // between a word and an opening quote, and between a closing quote and a following word.
    text = text
      .replace(/“[ \t]+/g, '“')
      .replace(/[ \t]+”/g, '”')
      .replace(/([\p{L}\p{N}.,;:!?])“/gu, '$1 “')
      .replace(/”(?=[\p{L}\p{N}])/gu, '” ');
  }

  // Single quotes and apostrophes.
  text = text
    .replace(/(?<=\p{L})'(?=\p{L})/gu, '’')
    .replace(/(?<=\p{L})'(?=\s|$|[.,;:!?)”])/gu, '’')
    .replace(/(?<=^|[\s(“])'(?=\p{L})/gu, '‘');

  return text;
}
