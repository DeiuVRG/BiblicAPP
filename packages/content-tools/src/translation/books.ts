import { escapeRegExp } from './text-utils';

/** A book of the Bible in the two notations the converter knows. */
export interface BookInfo {
  /** OSIS-like code used in canonical references, e.g. `Matt`, `1Cor`. */
  readonly code: string;
  /** Romanian abbreviation exactly as rendered, e.g. `Mat.`, `1 Cor.`, `Rut`. */
  readonly ro: string;
  readonly singleChapter: boolean;
}

interface BookSpec {
  code: string;
  ro: string;
  /** English abbreviations and full names, matched as written (case sensitive), with or without
   * a period. The number of numbered books is not part of the name. */
  names: readonly string[];
  singleChapter?: true;
}

/**
 * Names are the usual English forms plus the ones older theology uses (`Jno.`, `Mk.`, `Lk.`).
 * Ambiguous short forms (`Am`, `Jon`, `Jud`, `Mr`, `Ro`) are left out on purpose.
 */
const SPECS: readonly BookSpec[] = [
  { code: 'Gen', ro: 'Gen.', names: ['Gen', 'Genesis'] },
  { code: 'Exod', ro: 'Ex.', names: ['Ex', 'Exod', 'Exodus'] },
  { code: 'Lev', ro: 'Lev.', names: ['Lev', 'Leviticus'] },
  { code: 'Num', ro: 'Num.', names: ['Num', 'Numbers'] },
  { code: 'Deut', ro: 'Deut.', names: ['Deut', 'Deuteronomy'] },
  { code: 'Josh', ro: 'Ios.', names: ['Josh', 'Joshua'] },
  { code: 'Judg', ro: 'Jud.', names: ['Judg', 'Judges'] },
  { code: 'Ruth', ro: 'Rut', names: ['Ruth'] },
  { code: '1Sam', ro: '1 Sam.', names: ['1 Sam', '1 Samuel'] },
  { code: '2Sam', ro: '2 Sam.', names: ['2 Sam', '2 Samuel'] },
  { code: '1Kgs', ro: '1 Împ.', names: ['1 Kgs', '1 Ki', '1 Kings'] },
  { code: '2Kgs', ro: '2 Împ.', names: ['2 Kgs', '2 Ki', '2 Kings'] },
  { code: '1Chr', ro: '1 Cron.', names: ['1 Chr', '1 Chron', '1 Chronicles'] },
  { code: '2Chr', ro: '2 Cron.', names: ['2 Chr', '2 Chron', '2 Chronicles'] },
  { code: 'Ezra', ro: 'Ezra', names: ['Ezra'] },
  { code: 'Neh', ro: 'Neem.', names: ['Neh', 'Nehemiah'] },
  { code: 'Esth', ro: 'Est.', names: ['Esth', 'Esther'] },
  { code: 'Job', ro: 'Iov', names: ['Job'] },
  { code: 'Ps', ro: 'Ps.', names: ['Ps', 'Psa', 'Pss', 'Psalm', 'Psalms'] },
  { code: 'Prov', ro: 'Prov.', names: ['Prov', 'Proverbs'] },
  { code: 'Eccl', ro: 'Ecl.', names: ['Eccl', 'Eccles', 'Ecclesiastes'] },
  { code: 'Song', ro: 'Cânt.', names: ['Cant', 'Canticles', 'Song of Solomon', 'Song of Songs'] },
  { code: 'Isa', ro: 'Is.', names: ['Is', 'Isa', 'Isaiah'] },
  { code: 'Jer', ro: 'Ier.', names: ['Jer', 'Jeremiah'] },
  { code: 'Lam', ro: 'Plâng.', names: ['Lam', 'Lamentations'] },
  { code: 'Ezek', ro: 'Ezec.', names: ['Ezek', 'Ezekiel'] },
  { code: 'Dan', ro: 'Dan.', names: ['Dan', 'Daniel'] },
  { code: 'Hos', ro: 'Osea', names: ['Hos', 'Hosea'] },
  { code: 'Joel', ro: 'Ioel', names: ['Joel'] },
  { code: 'Amos', ro: 'Amos', names: ['Amos'] },
  { code: 'Obad', ro: 'Obad.', names: ['Obad', 'Obadiah'], singleChapter: true },
  { code: 'Jonah', ro: 'Iona', names: ['Jonah'] },
  { code: 'Mic', ro: 'Mica', names: ['Mic', 'Micah'] },
  { code: 'Nah', ro: 'Naum', names: ['Nah', 'Nahum'] },
  { code: 'Hab', ro: 'Hab.', names: ['Hab', 'Habakkuk'] },
  { code: 'Zeph', ro: 'Țef.', names: ['Zeph', 'Zephaniah'] },
  { code: 'Hag', ro: 'Hag.', names: ['Hag', 'Haggai'] },
  { code: 'Zech', ro: 'Zah.', names: ['Zech', 'Zechariah'] },
  { code: 'Mal', ro: 'Mal.', names: ['Mal', 'Malachi'] },
  { code: 'Matt', ro: 'Mat.', names: ['Matt', 'Mt', 'Matthew'] },
  { code: 'Mark', ro: 'Mc.', names: ['Mk', 'Mark'] },
  { code: 'Luke', ro: 'Lc.', names: ['Lk', 'Luke'] },
  { code: 'John', ro: 'In.', names: ['Jno', 'Jn', 'John'] },
  { code: 'Acts', ro: 'Fapte', names: ['Acts'] },
  { code: 'Rom', ro: 'Rom.', names: ['Rom', 'Romans'] },
  { code: '1Cor', ro: '1 Cor.', names: ['1 Cor', '1 Corinthians'] },
  { code: '2Cor', ro: '2 Cor.', names: ['2 Cor', '2 Corinthians'] },
  { code: 'Gal', ro: 'Gal.', names: ['Gal', 'Galatians'] },
  { code: 'Eph', ro: 'Ef.', names: ['Eph', 'Ephesians'] },
  { code: 'Phil', ro: 'Fil.', names: ['Phil', 'Philippians'] },
  { code: 'Col', ro: 'Col.', names: ['Col', 'Colossians'] },
  { code: '1Thess', ro: '1 Tes.', names: ['1 Thess', '1 Thessalonians'] },
  { code: '2Thess', ro: '2 Tes.', names: ['2 Thess', '2 Thessalonians'] },
  { code: '1Tim', ro: '1 Tim.', names: ['1 Tim', '1 Timothy'] },
  { code: '2Tim', ro: '2 Tim.', names: ['2 Tim', '2 Timothy'] },
  { code: 'Titus', ro: 'Tit', names: ['Tit', 'Titus'] },
  { code: 'Phlm', ro: 'Filim.', names: ['Philem', 'Philemon'], singleChapter: true },
  { code: 'Heb', ro: 'Evr.', names: ['Heb', 'Hebrews'] },
  { code: 'Jas', ro: 'Iac.', names: ['Jas', 'James'] },
  { code: '1Pet', ro: '1 Pet.', names: ['1 Pet', '1 Peter'] },
  { code: '2Pet', ro: '2 Pet.', names: ['2 Pet', '2 Peter'] },
  { code: '1John', ro: '1 In.', names: ['1 Jno', '1 Jn', '1 John'] },
  { code: '2John', ro: '2 In.', names: ['2 Jno', '2 Jn', '2 John'], singleChapter: true },
  { code: '3John', ro: '3 In.', names: ['3 Jno', '3 Jn', '3 John'], singleChapter: true },
  { code: 'Jude', ro: 'Iuda', names: ['Jude'], singleChapter: true },
  { code: 'Rev', ro: 'Apoc.', names: ['Rev', 'Revelation'] },
];

const ENTRIES = SPECS.map((spec): { spec: BookSpec; info: BookInfo } => ({
  spec,
  info: { code: spec.code, ro: spec.ro, singleChapter: spec.singleChapter === true },
}));

/** The 66 books in canonical order. */
export const BOOKS: readonly BookInfo[] = ENTRIES.map((entry) => entry.info);

const NUMBERED_NAME = /^([123]) (.+)$/;

function splitNumber(name: string): { number: string; base: string } {
  const match = NUMBERED_NAME.exec(name);
  return match ? { number: match[1] ?? '', base: match[2] ?? name } : { number: '', base: name };
}

/** Key of a lookup: the number glued to the name without spaces, e.g. `1Cor`. */
function lookupKey(number: string, base: string): string {
  return `${number}${base.replace(/\s+/g, '')}`;
}

const ENGLISH = new Map<string, BookInfo>();
const ROMANIAN = new Map<string, BookInfo>();
const englishBases = new Set<string>();
const romanianBases = new Set<string>();

function register(table: Map<string, BookInfo>, key: string, info: BookInfo): void {
  const existing = table.get(key);
  if (existing && existing !== info) {
    throw new Error(`book table: "${key}" names both ${existing.code} and ${info.code}`);
  }
  table.set(key, info);
}

for (const { spec, info } of ENTRIES) {
  for (const name of spec.names) {
    const { number, base } = splitNumber(name);
    register(ENGLISH, lookupKey(number, base), info);
    englishBases.add(base);
  }
  const ro = splitNumber(spec.ro.replace(/\.$/, ''));
  register(ROMANIAN, lookupKey(ro.number, ro.base), info);
  romanianBases.add(ro.base);
}

function alternation(bases: Iterable<string>, spellVariants: (escaped: string) => string): string {
  return [...bases]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((base) => spellVariants(escapeRegExp(base)))
    .join('|');
}

/** Regex source matching any English book name (without number prefix and without period). */
export const ENGLISH_BOOK_PATTERN = alternation(englishBases, (name) => name.replace(/ /g, '\\s+'));

/** The same for the Romanian abbreviations; cedilla spellings are accepted for Ț/ț. */
export const ROMANIAN_BOOK_PATTERN = alternation(romanianBases, (name) =>
  name.replace(/\u021A/g, '[\u021A\u0162]').replace(/\u021B/g, '[\u021B\u0163]'),
);

export function lookupEnglishBook(number: string | undefined, name: string): BookInfo | undefined {
  return ENGLISH.get(lookupKey(number ?? '', name));
}

export function lookupRomanianBook(number: string | undefined, name: string): BookInfo | undefined {
  return ROMANIAN.get(
    lookupKey(number ?? '', name.replace(/\u0162/g, '\u021A').replace(/\u0163/g, '\u021B')),
  );
}

/** Names compared to decide whether an English-looking token is also valid Romanian. */
export function sameRomanianAbbreviation(token: string, book: BookInfo): boolean {
  const strip = (text: string): string => text.replace(/[.\s]/g, '');
  return strip(token) === strip(book.ro);
}
