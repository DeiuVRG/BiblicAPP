import { foldText } from './fold';

export interface TextPart {
  text: string;
  match: boolean;
}

/** Splits `text` into parts, flagging every occurrence of `query` (case/diacritics ignored). */
export function splitByMatches(text: string, query: string): TextPart[] {
  const needle = foldText(query.trim());
  if (needle.length === 0) return [{ text, match: false }];
  const haystack = foldText(text);
  const parts: TextPart[] = [];
  let cursor = 0;
  for (;;) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) break;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
