// A strict Roman numeral (1 to 3999); "CIVIL" or "MIX" are words, not numerals.
const ROMAN = '(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';
const NUMBERED = new RegExp(`^\\s*(${ROMAN})\\.\\s+(\\S.*)$`);

export interface ChapterHeading {
  /** The chapter's Roman numeral as printed in the source ("IV"), or an empty string. */
  numeral: string;
  /** The heading without its numeral. */
  title: string;
}

/** Splits "IV. The Present and the Future Kingdom" into its numeral and its title. */
export function splitChapterHeading(heading: string): ChapterHeading {
  const match = NUMBERED.exec(heading);
  return match
    ? { numeral: match[1] ?? '', title: match[2] ?? heading }
    : { numeral: '', title: heading };
}
