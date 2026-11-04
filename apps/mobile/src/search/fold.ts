const COMBINING_MARKS = /\p{Diacritic}/gu;

/** Folds one UTF-16 code unit: lower case, no diacritics, typographic quotes straightened. */
function foldChar(char: string): string {
  if (char === '‘' || char === '’' || char === 'ʼ') return "'";
  if (char === '“' || char === '”') return '"';
  if (char === 'ς') return 'σ'; // Greek final sigma
  const folded = char.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
  // Keep the fold length-preserving so match offsets map back onto the original text.
  return folded.length === 1 ? folded : char.toLowerCase().slice(0, 1) || char;
}

/**
 * Case- and diacritic-insensitive fold used for search. The result always has the same length
 * as the input, so an index found in the folded text is valid in the original text.
 */
export function foldText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) out += foldChar(text[i] as string);
  return out;
}
