// Romanian is written with comma-below `ș` and `ț` only (docs/ui-spec-v2.md, section 17.5). The
// cedilla forms `ş` and `ţ` look the same and are different characters (search and sorting stop
// matching them), so no string table, source file or catalogue may contain them.

/** Matches a cedilla form: U+015E, U+015F, U+0162, U+0163. */
export const CEDILLA = /[ŞşŢţ]/;

/** The cedilla characters in a text, each once (an empty string when there is none). */
export function findCedillas(text: string): string {
  return [...new Set([...text].filter((char) => CEDILLA.test(char)))].join('');
}

/** Replaces the cedilla forms with the comma-below letters (for cleaning imported text). */
export function fixCedillas(text: string): string {
  return text.replace(/Ş/g, 'Ș').replace(/ş/g, 'ș').replace(/Ţ/g, 'Ț').replace(/ţ/g, 'ț');
}
