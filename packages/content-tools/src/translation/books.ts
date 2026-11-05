import { escapeRegExp } from './text-utils';

/** A book of the Bible in the notations the converter knows. */
export interface BookInfo {
  /** OSIS-like code used in canonical references, e.g. `Matt`, `1Cor`. */
  readonly code: string;
  /** Romanian abbreviation exactly as rendered, e.g. `Mat.`, `1 Cor.`, `Rut`. */
  readonly ro: string;
  /** English abbreviation exactly as rendered in an English translation, e.g. `Matt.`, `John`. */
  readonly en: string;
  readonly singleChapter: boolean;
}

interface BookSpec {
  code: string;
  ro: string;
  en: string;
  /** English abbreviations and full names, matched as written (case sensitive), with or without
   * a period. The number of numbered books is not part of the name. */
  names: readonly string[];
  /**
   * Names that only an English translation is read with, not an English source: the abbreviation
   * the notation of a translation writes but that older theology does not (`Song of Sol.`). The
   * source grammar keeps reading what it always read, so the jobs of an English source do not
   * change.
   */
  targetNames?: readonly string[];
  singleChapter?: true;
}

/**
 * Names are the usual English forms plus the ones older theology uses (`Jno.`, `Mk.`, `Lk.`).
 * Ambiguous short forms (`Am`, `Jon`, `Jud`, `Mr`, `Ro`) are left out on purpose.
 */
const SPECS: readonly BookSpec[] = [
  { code: 'Gen', ro: 'Gen.', en: 'Gen.', names: ['Gen', 'Genesis'] },
  { code: 'Exod', ro: 'Ex.', en: 'Exod.', names: ['Ex', 'Exod', 'Exodus'] },
  { code: 'Lev', ro: 'Lev.', en: 'Lev.', names: ['Lev', 'Leviticus'] },
  { code: 'Num', ro: 'Num.', en: 'Num.', names: ['Num', 'Numbers'] },
  { code: 'Deut', ro: 'Deut.', en: 'Deut.', names: ['Deut', 'Deuteronomy'] },
  { code: 'Josh', ro: 'Ios.', en: 'Josh.', names: ['Josh', 'Joshua'] },
  { code: 'Judg', ro: 'Jud.', en: 'Judg.', names: ['Judg', 'Judges'] },
  { code: 'Ruth', ro: 'Rut', en: 'Ruth', names: ['Ruth'] },
  { code: '1Sam', ro: '1 Sam.', en: '1 Sam.', names: ['1 Sam', '1 Samuel'] },
  { code: '2Sam', ro: '2 Sam.', en: '2 Sam.', names: ['2 Sam', '2 Samuel'] },
  { code: '1Kgs', ro: '1 Împ.', en: '1 Kings', names: ['1 Kgs', '1 Ki', '1 Kings'] },
  { code: '2Kgs', ro: '2 Împ.', en: '2 Kings', names: ['2 Kgs', '2 Ki', '2 Kings'] },
  { code: '1Chr', ro: '1 Cron.', en: '1 Chron.', names: ['1 Chr', '1 Chron', '1 Chronicles'] },
  { code: '2Chr', ro: '2 Cron.', en: '2 Chron.', names: ['2 Chr', '2 Chron', '2 Chronicles'] },
  { code: 'Ezra', ro: 'Ezra', en: 'Ezra', names: ['Ezra'] },
  { code: 'Neh', ro: 'Neem.', en: 'Neh.', names: ['Neh', 'Nehemiah'] },
  { code: 'Esth', ro: 'Est.', en: 'Esther', names: ['Esth', 'Esther'] },
  { code: 'Job', ro: 'Iov', en: 'Job', names: ['Job'] },
  { code: 'Ps', ro: 'Ps.', en: 'Ps.', names: ['Ps', 'Psa', 'Pss', 'Psalm', 'Psalms'] },
  { code: 'Prov', ro: 'Prov.', en: 'Prov.', names: ['Prov', 'Proverbs'] },
  { code: 'Eccl', ro: 'Ecl.', en: 'Eccles.', names: ['Eccl', 'Eccles', 'Ecclesiastes'] },
  {
    code: 'Song',
    ro: 'Cânt.',
    en: 'Song of Sol.',
    names: ['Cant', 'Canticles', 'Song of Solomon', 'Song of Songs'],
    targetNames: ['Song of Sol'],
  },
  { code: 'Isa', ro: 'Is.', en: 'Isa.', names: ['Is', 'Isa', 'Isaiah'] },
  { code: 'Jer', ro: 'Ier.', en: 'Jer.', names: ['Jer', 'Jeremiah'] },
  { code: 'Lam', ro: 'Plâng.', en: 'Lam.', names: ['Lam', 'Lamentations'] },
  { code: 'Ezek', ro: 'Ezec.', en: 'Ezek.', names: ['Ezek', 'Ezekiel'] },
  { code: 'Dan', ro: 'Dan.', en: 'Dan.', names: ['Dan', 'Daniel'] },
  { code: 'Hos', ro: 'Osea', en: 'Hosea', names: ['Hos', 'Hosea'] },
  { code: 'Joel', ro: 'Ioel', en: 'Joel', names: ['Joel'] },
  { code: 'Amos', ro: 'Amos', en: 'Amos', names: ['Amos'] },
  { code: 'Obad', ro: 'Obad.', en: 'Obad.', names: ['Obad', 'Obadiah'], singleChapter: true },
  { code: 'Jonah', ro: 'Iona', en: 'Jonah', names: ['Jonah'] },
  { code: 'Mic', ro: 'Mica', en: 'Mic.', names: ['Mic', 'Micah'] },
  { code: 'Nah', ro: 'Naum', en: 'Nah.', names: ['Nah', 'Nahum'] },
  { code: 'Hab', ro: 'Hab.', en: 'Hab.', names: ['Hab', 'Habakkuk'] },
  { code: 'Zeph', ro: 'Țef.', en: 'Zeph.', names: ['Zeph', 'Zephaniah'] },
  { code: 'Hag', ro: 'Hag.', en: 'Hag.', names: ['Hag', 'Haggai'] },
  { code: 'Zech', ro: 'Zah.', en: 'Zech.', names: ['Zech', 'Zechariah'] },
  { code: 'Mal', ro: 'Mal.', en: 'Mal.', names: ['Mal', 'Malachi'] },
  { code: 'Matt', ro: 'Mat.', en: 'Matt.', names: ['Matt', 'Mt', 'Matthew'] },
  { code: 'Mark', ro: 'Mc.', en: 'Mark', names: ['Mk', 'Mark'] },
  { code: 'Luke', ro: 'Lc.', en: 'Luke', names: ['Lk', 'Luke'] },
  { code: 'John', ro: 'In.', en: 'John', names: ['Jno', 'Jn', 'John'] },
  { code: 'Acts', ro: 'Fapte', en: 'Acts', names: ['Acts'] },
  { code: 'Rom', ro: 'Rom.', en: 'Rom.', names: ['Rom', 'Romans'] },
  { code: '1Cor', ro: '1 Cor.', en: '1 Cor.', names: ['1 Cor', '1 Corinthians'] },
  { code: '2Cor', ro: '2 Cor.', en: '2 Cor.', names: ['2 Cor', '2 Corinthians'] },
  { code: 'Gal', ro: 'Gal.', en: 'Gal.', names: ['Gal', 'Galatians'] },
  { code: 'Eph', ro: 'Ef.', en: 'Eph.', names: ['Eph', 'Ephesians'] },
  { code: 'Phil', ro: 'Fil.', en: 'Phil.', names: ['Phil', 'Philippians'] },
  { code: 'Col', ro: 'Col.', en: 'Col.', names: ['Col', 'Colossians'] },
  { code: '1Thess', ro: '1 Tes.', en: '1 Thess.', names: ['1 Thess', '1 Thessalonians'] },
  { code: '2Thess', ro: '2 Tes.', en: '2 Thess.', names: ['2 Thess', '2 Thessalonians'] },
  { code: '1Tim', ro: '1 Tim.', en: '1 Tim.', names: ['1 Tim', '1 Timothy'] },
  { code: '2Tim', ro: '2 Tim.', en: '2 Tim.', names: ['2 Tim', '2 Timothy'] },
  { code: 'Titus', ro: 'Tit', en: 'Titus', names: ['Tit', 'Titus'] },
  { code: 'Phlm', ro: 'Filim.', en: 'Philem.', names: ['Philem', 'Philemon'], singleChapter: true },
  { code: 'Heb', ro: 'Evr.', en: 'Heb.', names: ['Heb', 'Hebrews'] },
  { code: 'Jas', ro: 'Iac.', en: 'James', names: ['Jas', 'James'] },
  { code: '1Pet', ro: '1 Pet.', en: '1 Pet.', names: ['1 Pet', '1 Peter'] },
  { code: '2Pet', ro: '2 Pet.', en: '2 Pet.', names: ['2 Pet', '2 Peter'] },
  { code: '1John', ro: '1 In.', en: '1 John', names: ['1 Jno', '1 Jn', '1 John'] },
  {
    code: '2John',
    ro: '2 In.',
    en: '2 John',
    names: ['2 Jno', '2 Jn', '2 John'],
    singleChapter: true,
  },
  {
    code: '3John',
    ro: '3 In.',
    en: '3 John',
    names: ['3 Jno', '3 Jn', '3 John'],
    singleChapter: true,
  },
  { code: 'Jude', ro: 'Iuda', en: 'Jude', names: ['Jude'], singleChapter: true },
  { code: 'Rev', ro: 'Apoc.', en: 'Rev.', names: ['Rev', 'Revelation'] },
];

/**
 * Books that the Vulgate has and the 66 do not: the deuterocanonical books that a Latin source
 * cites. They are not in `BOOKS` (the 66 of the specification) and the English grammar of
 * sources does not read them; the Latin grammar, the English and the Romanian notation of a
 * translation do.
 */
const EXTRA_SPECS: readonly BookSpec[] = [
  { code: 'Tob', ro: 'Tob.', en: 'Tob.', names: ['Tob', 'Tobit'] },
  { code: 'Jdt', ro: 'Iudt.', en: 'Jdt.', names: ['Jdt', 'Judith'] },
  { code: 'Wis', ro: 'Înț.', en: 'Wis.', names: ['Wis', 'Wisdom'] },
  { code: 'Sir', ro: 'Sir.', en: 'Sir.', names: ['Sir', 'Sirach', 'Ecclus', 'Ecclesiasticus'] },
  { code: 'Bar', ro: 'Bar.', en: 'Bar.', names: ['Bar', 'Baruch'] },
  { code: '1Macc', ro: '1 Mac.', en: '1 Macc.', names: ['1 Macc', '1 Mac', '1 Maccabees'] },
  { code: '2Macc', ro: '2 Mac.', en: '2 Macc.', names: ['2 Macc', '2 Mac', '2 Maccabees'] },
];

function infoOf(spec: BookSpec): BookInfo {
  return { code: spec.code, ro: spec.ro, en: spec.en, singleChapter: spec.singleChapter === true };
}

const ENTRIES = SPECS.map((spec): { spec: BookSpec; info: BookInfo } => ({
  spec,
  info: infoOf(spec),
}));
const EXTRA_ENTRIES = EXTRA_SPECS.map((spec): { spec: BookSpec; info: BookInfo } => ({
  spec,
  info: infoOf(spec),
}));

/** The 66 books in canonical order. */
export const BOOKS: readonly BookInfo[] = ENTRIES.map((entry) => entry.info);

/** The 66 books followed by the deuterocanonical books of the Vulgate. */
export const ALL_BOOKS: readonly BookInfo[] = [
  ...BOOKS,
  ...EXTRA_ENTRIES.map((entry) => entry.info),
];

const BY_CODE = new Map(ALL_BOOKS.map((book) => [book.code, book]));

export function bookByCode(code: string): BookInfo | undefined {
  return BY_CODE.get(code);
}

const NUMBERED_NAME = /^([123]) (.+)$/;

function splitNumber(name: string): { number: string; base: string } {
  const match = NUMBERED_NAME.exec(name);
  return match ? { number: match[1] ?? '', base: match[2] ?? name } : { number: '', base: name };
}

/** Key of a lookup: the number glued to the name without spaces, e.g. `1Cor`. */
function lookupKey(number: string, base: string): string {
  return `${number}${base.replace(/\s+/g, '')}`;
}

function register<T>(
  table: Map<string, T>,
  key: string,
  value: T,
  describe: (v: T) => string,
): void {
  const existing = table.get(key);
  if (existing !== undefined && existing !== value) {
    throw new Error(`book table: "${key}" names both ${describe(existing)} and ${describe(value)}`);
  }
  table.set(key, value);
}

const codeOf = (info: BookInfo): string => info.code;

// The English names read in the source (66 books, as before), the English names read in a
// translation (the same and the deuterocanonical books), the Romanian abbreviations.
const ENGLISH = new Map<string, BookInfo>();
const ENGLISH_TARGET = new Map<string, BookInfo>();
const ROMANIAN = new Map<string, BookInfo>();
const englishBases = new Set<string>();
const englishTargetBases = new Set<string>();
const romanianBases = new Set<string>();

for (const { spec, info } of [...ENTRIES, ...EXTRA_ENTRIES]) {
  const inSource = BOOKS.includes(info);
  for (const name of spec.names) {
    const { number, base } = splitNumber(name);
    if (inSource) {
      register(ENGLISH, lookupKey(number, base), info, codeOf);
      englishBases.add(base);
    }
    register(ENGLISH_TARGET, lookupKey(number, base), info, codeOf);
    englishTargetBases.add(base);
  }
  for (const name of spec.targetNames ?? []) {
    const { number, base } = splitNumber(name);
    register(ENGLISH_TARGET, lookupKey(number, base), info, codeOf);
    englishTargetBases.add(base);
  }
  const ro = splitNumber(spec.ro.replace(/\.$/, ''));
  register(ROMANIAN, lookupKey(ro.number, ro.base), info, codeOf);
  romanianBases.add(ro.base);
}

function alternation(bases: Iterable<string>, spellVariants: (escaped: string) => string): string {
  return [...bases]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((base) => spellVariants(escapeRegExp(base)))
    .join('|');
}

const spaced = (name: string): string => name.replace(/ /g, '\\s+');

/** Regex source matching any English book name (without number prefix and without period). */
export const ENGLISH_BOOK_PATTERN = alternation(englishBases, spaced);

/** The same for the names read in an English translation: the 66 books and the Vulgate extras. */
export const ENGLISH_TARGET_BOOK_PATTERN = alternation(englishTargetBases, spaced);

/** The same for the Romanian abbreviations; cedilla spellings are accepted for Ț/ț. */
export const ROMANIAN_BOOK_PATTERN = alternation(romanianBases, (name) =>
  name.replace(/\u021A/g, '[\u021A\u0162]').replace(/\u021B/g, '[\u021B\u0163]'),
);

export function lookupEnglishBook(number: string | undefined, name: string): BookInfo | undefined {
  return ENGLISH.get(lookupKey(number ?? '', name));
}

/** An English name as an English translation may write it (the 66 books and the Vulgate extras). */
export function lookupEnglishTargetBook(
  number: string | undefined,
  name: string,
): BookInfo | undefined {
  return ENGLISH_TARGET.get(lookupKey(number ?? '', name));
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

// ---------------------------------------------------------------------------------------------
// Latin (the names of the Vulgate)

/** A book as a Latin text names it. */
export interface LatinBook {
  book: BookInfo;
  /** The Vulgate numbers this book differently from the Hebrew Bible (psalms, Kings, Esdras). */
  vulgate: boolean;
  /** What a translator must know about the abbreviation, when it is not obvious. */
  note?: string;
}

interface LatinSpec {
  /** Latin abbreviations and names, matched as written (case sensitive), with or without period. */
  names: readonly string[];
  /** Canonical code by the number before the name (`''` when the name stands alone). */
  codes: Readonly<Record<string, string>>;
  vulgate?: true;
  note?: string;
}

const PSALM_NOTE =
  'Vulgate psalm numbering (the Vulgate Ps. 118 is Ps. 119 in the Hebrew numbering of most ' +
  'modern Bibles): keep the number of the source, do not renumber.';
const KINGS_NOTE =
  'Vulgate numbering of the books of Kings: 1 and 2 Reg. are 1 and 2 Samuel, 3 and 4 Reg. are ' +
  '1 and 2 Kings; the translation uses the usual names.';
const ESDRAS_NOTE =
  'Vulgate numbering: 1 Esdr. is Ezra and 2 Esdr. is Nehemiah; the translation uses the usual names.';
const JUDE_NOTE =
  'Iud./Jud. is read as the Epistle of Jude (one chapter); the Book of Judges is Iudic./Judic.';

// Latin works abbreviate with `i` or `j` (Ioh., Joh.) and with or without the final letters.
// Ambiguous short forms (`Ez.`, `Jo.`, `Ap.`, `Mr.`) are left out on purpose.
const LATIN_SPECS: readonly LatinSpec[] = [
  { names: ['Gen'], codes: { '': 'Gen' } },
  { names: ['Exod', 'Ex'], codes: { '': 'Exod' } },
  { names: ['Lev'], codes: { '': 'Lev' } },
  { names: ['Num'], codes: { '': 'Num' } },
  { names: ['Deut'], codes: { '': 'Deut' } },
  { names: ['Ios', 'Jos', 'Iosue', 'Josue'], codes: { '': 'Josh' } },
  { names: ['Iudic', 'Judic'], codes: { '': 'Judg' } },
  { names: ['Ruth'], codes: { '': 'Ruth' } },
  {
    names: ['Reg', 'Regum'],
    codes: { '1': '1Sam', '2': '2Sam', '3': '1Kgs', '4': '2Kgs' },
    vulgate: true,
    note: KINGS_NOTE,
  },
  { names: ['Par', 'Paral', 'Paralip'], codes: { '1': '1Chr', '2': '2Chr' } },
  {
    names: ['Esdr', 'Esd'],
    codes: { '': 'Ezra', '1': 'Ezra', '2': 'Neh' },
    vulgate: true,
    note: ESDRAS_NOTE,
  },
  { names: ['Neh'], codes: { '': 'Neh' } },
  { names: ['Tob', 'Tobiae'], codes: { '': 'Tob' } },
  { names: ['Iudith', 'Judith', 'Iudit', 'Judit'], codes: { '': 'Jdt' } },
  { names: ['Esth', 'Est'], codes: { '': 'Esth' } },
  { names: ['Iob', 'Job'], codes: { '': 'Job' } },
  {
    names: ['Ps', 'Psal', 'Psalm', 'Pss'],
    codes: { '': 'Ps' },
    vulgate: true,
    note: PSALM_NOTE,
  },
  { names: ['Prov'], codes: { '': 'Prov' } },
  { names: ['Eccl', 'Eccle', 'Eccles'], codes: { '': 'Eccl' } },
  { names: ['Cant', 'Canticum'], codes: { '': 'Song' } },
  { names: ['Sap'], codes: { '': 'Wis' } },
  { names: ['Eccli', 'Sir', 'Ecclus'], codes: { '': 'Sir' } },
  { names: ['Is', 'Isa'], codes: { '': 'Isa' } },
  { names: ['Ier', 'Jer'], codes: { '': 'Jer' } },
  { names: ['Thren'], codes: { '': 'Lam' } },
  { names: ['Bar'], codes: { '': 'Bar' } },
  { names: ['Ezech'], codes: { '': 'Ezek' } },
  { names: ['Dan'], codes: { '': 'Dan' } },
  { names: ['Os', 'Osee'], codes: { '': 'Hos' } },
  { names: ['Ioel', 'Joel'], codes: { '': 'Joel' } },
  { names: ['Am', 'Amos'], codes: { '': 'Amos' } },
  { names: ['Abd', 'Abdias'], codes: { '': 'Obad' } },
  { names: ['Ion', 'Jon', 'Ionas', 'Jonas'], codes: { '': 'Jonah' } },
  { names: ['Mich'], codes: { '': 'Mic' } },
  { names: ['Nah'], codes: { '': 'Nah' } },
  { names: ['Hab'], codes: { '': 'Hab' } },
  { names: ['Soph'], codes: { '': 'Zeph' } },
  { names: ['Agg'], codes: { '': 'Hag' } },
  { names: ['Zach'], codes: { '': 'Zech' } },
  { names: ['Mal'], codes: { '': 'Mal' } },
  { names: ['Mach', 'Macc'], codes: { '1': '1Macc', '2': '2Macc' } },
  { names: ['Matth', 'Matt', 'Mt'], codes: { '': 'Matt' } },
  { names: ['Marc', 'Mc'], codes: { '': 'Mark' } },
  { names: ['Luc', 'Lc'], codes: { '': 'Luke' } },
  {
    names: ['Ioh', 'Joh', 'Ioann', 'Joann', 'Ioan', 'Joan', 'Jn'],
    codes: { '': 'John', '1': '1John', '2': '2John', '3': '3John' },
  },
  { names: ['Act'], codes: { '': 'Acts' } },
  { names: ['Rom'], codes: { '': 'Rom' } },
  { names: ['Cor'], codes: { '1': '1Cor', '2': '2Cor' } },
  { names: ['Gal'], codes: { '': 'Gal' } },
  { names: ['Eph', 'Ephes'], codes: { '': 'Eph' } },
  { names: ['Phil', 'Philipp'], codes: { '': 'Phil' } },
  { names: ['Col', 'Coloss'], codes: { '': 'Col' } },
  { names: ['Thess', 'Thessal'], codes: { '1': '1Thess', '2': '2Thess' } },
  { names: ['Tim'], codes: { '1': '1Tim', '2': '2Tim' } },
  { names: ['Tit'], codes: { '': 'Titus' } },
  { names: ['Philem'], codes: { '': 'Phlm' } },
  { names: ['Hebr', 'Heb'], codes: { '': 'Heb' } },
  { names: ['Iac', 'Jac'], codes: { '': 'Jas' } },
  { names: ['Petr', 'Pet'], codes: { '1': '1Pet', '2': '2Pet' } },
  { names: ['Iud', 'Jud'], codes: { '': 'Jude' }, note: JUDE_NOTE },
  { names: ['Apoc'], codes: { '': 'Rev' } },
];

const LATIN = new Map<string, LatinBook>();
const latinBases = new Set<string>();

for (const spec of LATIN_SPECS) {
  for (const name of spec.names) {
    latinBases.add(name);
    for (const [number, code] of Object.entries(spec.codes)) {
      const book = BY_CODE.get(code);
      if (!book) throw new Error(`book table: the Latin name "${name}" names the unknown ${code}`);
      const entry: LatinBook = { book, vulgate: spec.vulgate === true };
      if (spec.note !== undefined) entry.note = spec.note;
      register(LATIN, lookupKey(number, name), entry, (v) => v.book.code);
    }
  }
}

/** Regex source matching any Latin book name (without number prefix and without period). */
export const LATIN_BOOK_PATTERN = alternation(latinBases, spaced);

/**
 * A Latin name with the number before it (`1`, `2`, `3` or `4`; the roman numeral of `I Cor.` is
 * turned into a digit by the caller). A numbered book without its number is not found.
 */
export function lookupLatinBook(number: string | undefined, name: string): LatinBook | undefined {
  return LATIN.get(lookupKey(number ?? '', name));
}

/** True when the token is valid in the English notation of a translation (`Matt`, `Mt`, `John`). */
export function isEnglishName(number: string | undefined, name: string): boolean {
  return ENGLISH_TARGET.has(lookupKey(number ?? '', name));
}
