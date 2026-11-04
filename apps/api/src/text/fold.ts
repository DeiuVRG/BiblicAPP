const COMBINING_MARKS = /\p{M}/gu;

/** Folds one UTF-16 code unit: lower case, no diacritics, typographic quotes straightened. */
function foldChar(char: string): string {
  // ASCII has no combining form and only A-Z change: skip the Unicode normalisation, which is by
  // far the most expensive step and not needed for most of the text.
  const code = char.charCodeAt(0);
  if (code < 0x80) return code >= 0x41 && code <= 0x5a ? String.fromCharCode(code + 0x20) : char;
  if (char === '‘' || char === '’' || char === 'ʼ') return "'";
  if (char === '“' || char === '”') return '"';
  if (char === 'ς') return 'σ'; // Greek final sigma
  const folded = char.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
  // Keep the fold length-preserving so offsets found in the folded text are valid in the original.
  return folded.length === 1 ? folded : char.toLowerCase().slice(0, 1) || char;
}

/**
 * Case- and diacritic-insensitive fold, the same as the app's search (`apps/mobile/src/search/
 * fold.ts`): the result always has the same length as the input. Feed it NFC text (the packs are
 * NFC); decomposed input keeps its combining marks.
 */
export function foldText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) out += foldChar(text[i] as string);
  return out;
}

/** NFC-normalises user input before it is folded or searched. */
export function normaliseInput(text: string): string {
  return text.normalize('NFC');
}
