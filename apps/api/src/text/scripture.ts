import { foldText, normaliseInput } from './fold';

// Scripture references: "Mat. 4:17", "Matthew 4:17" and "Matei 4:17" are the same reference, and
// so are the old-style notations found in the texts themselves ("Matt. iv. 17; Mk. i. 15", with
// roman chapter numerals). This is the reference grammar of `packages/content-tools/src/
// translation/references.ts` reduced to what retrieval needs: find references in running text and
// reduce them to a canonical (book, chapter, verse range) triple.

export interface ScriptureRef {
  /** OSIS-like book code, the same as content-tools uses (`Matt`, `1Cor`, `Ps`). */
  book: string;
  chapter: number;
  /** First verse; `null` for a reference to the whole chapter. */
  from: number | null;
  /** Last verse (equal to `from` for a single verse); `null` for a whole chapter. */
  to: number | null;
}

export interface ParsedRef extends ScriptureRef {
  /** Offsets of the reference in the (NFC-normalised) text it was found in; `end` is exclusive. */
  start: number;
  end: number;
}

interface BookSpec {
  code: string;
  en: readonly string[];
  ro: readonly string[];
  singleChapter?: true;
}

const BOOKS: readonly BookSpec[] = [
  { code: 'Gen', en: ['Genesis', 'Gen', 'Gn'], ro: ['Geneza', 'Gen'] },
  { code: 'Exod', en: ['Exodus', 'Exod', 'Ex'], ro: ['Exodul', 'Exod', 'Ex'] },
  { code: 'Lev', en: ['Leviticus', 'Lev'], ro: ['Leviticul', 'Lev'] },
  { code: 'Num', en: ['Numbers', 'Num'], ro: ['Numeri', 'Num'] },
  { code: 'Deut', en: ['Deuteronomy', 'Deut', 'Dt'], ro: ['Deuteronomul', 'Deut', 'Dt'] },
  { code: 'Josh', en: ['Joshua', 'Josh'], ro: ['Iosua', 'Ios'] },
  { code: 'Judg', en: ['Judges', 'Judg'], ro: ['Judecători', 'Jud'] },
  { code: 'Ruth', en: ['Ruth'], ro: ['Rut'] },
  { code: '1Sam', en: ['1 Samuel', '1 Sam'], ro: ['1 Samuel', '1 Sam'] },
  { code: '2Sam', en: ['2 Samuel', '2 Sam'], ro: ['2 Samuel', '2 Sam'] },
  { code: '1Kgs', en: ['1 Kings', '1 Kgs', '1 Ki'], ro: ['1 Împărați', '1 Împ'] },
  { code: '2Kgs', en: ['2 Kings', '2 Kgs', '2 Ki'], ro: ['2 Împărați', '2 Împ'] },
  { code: '1Chr', en: ['1 Chronicles', '1 Chron', '1 Chr'], ro: ['1 Cronici', '1 Cron'] },
  { code: '2Chr', en: ['2 Chronicles', '2 Chron', '2 Chr'], ro: ['2 Cronici', '2 Cron'] },
  { code: 'Ezra', en: ['Ezra'], ro: ['Ezra'] },
  { code: 'Neh', en: ['Nehemiah', 'Neh'], ro: ['Neemia', 'Neem'] },
  { code: 'Esth', en: ['Esther', 'Esth'], ro: ['Estera', 'Est'] },
  { code: 'Job', en: ['Job'], ro: ['Iov'] },
  {
    code: 'Ps',
    en: ['Psalms', 'Psalm', 'Ps', 'Psa', 'Pss'],
    ro: ['Psalmii', 'Psalmi', 'Psalmul', 'Psalm', 'Ps'],
  },
  { code: 'Prov', en: ['Proverbs', 'Prov'], ro: ['Proverbe', 'Prov'] },
  { code: 'Eccl', en: ['Ecclesiastes', 'Eccles', 'Eccl'], ro: ['Eclesiastul', 'Ecl'] },
  {
    code: 'Song',
    en: ['Song of Solomon', 'Song of Songs', 'Canticles', 'Cant'],
    ro: ['Cântarea Cântărilor', 'Cânt'],
  },
  { code: 'Isa', en: ['Isaiah', 'Isa', 'Is'], ro: ['Isaia', 'Is'] },
  { code: 'Jer', en: ['Jeremiah', 'Jer'], ro: ['Ieremia', 'Ier'] },
  {
    code: 'Lam',
    en: ['Lamentations', 'Lam'],
    ro: ['Plângerile lui Ieremia', 'Plângerile', 'Plâng'],
  },
  { code: 'Ezek', en: ['Ezekiel', 'Ezek'], ro: ['Ezechiel', 'Ezec'] },
  { code: 'Dan', en: ['Daniel', 'Dan'], ro: ['Daniel', 'Dan'] },
  { code: 'Hos', en: ['Hosea', 'Hos'], ro: ['Osea', 'Os'] },
  { code: 'Joel', en: ['Joel'], ro: ['Ioel'] },
  { code: 'Amos', en: ['Amos'], ro: ['Amos'] },
  { code: 'Obad', en: ['Obadiah', 'Obad'], ro: ['Obadia', 'Obad'], singleChapter: true },
  { code: 'Jonah', en: ['Jonah'], ro: ['Iona'] },
  { code: 'Mic', en: ['Micah', 'Mic'], ro: ['Mica'] },
  { code: 'Nah', en: ['Nahum', 'Nah'], ro: ['Naum'] },
  { code: 'Hab', en: ['Habakkuk', 'Hab'], ro: ['Habacuc', 'Hab'] },
  { code: 'Zeph', en: ['Zephaniah', 'Zeph'], ro: ['Țefania', 'Țef'] },
  { code: 'Hag', en: ['Haggai', 'Hag'], ro: ['Hagai', 'Hag'] },
  { code: 'Zech', en: ['Zechariah', 'Zech'], ro: ['Zaharia', 'Zah'] },
  { code: 'Mal', en: ['Malachi', 'Mal'], ro: ['Maleahi', 'Mal'] },
  { code: 'Matt', en: ['Matthew', 'Matt', 'Mt'], ro: ['Matei', 'Mat', 'Mt'] },
  { code: 'Mark', en: ['Mark', 'Mk'], ro: ['Marcu', 'Mc'] },
  { code: 'Luke', en: ['Luke', 'Lk'], ro: ['Luca', 'Lc'] },
  { code: 'John', en: ['John', 'Jn', 'Jno'], ro: ['Ioan', 'In'] },
  { code: 'Acts', en: ['Acts of the Apostles', 'Acts'], ro: ['Faptele Apostolilor', 'Fapte'] },
  { code: 'Rom', en: ['Romans', 'Rom'], ro: ['Romani', 'Rom'] },
  { code: '1Cor', en: ['1 Corinthians', '1 Cor'], ro: ['1 Corinteni', '1 Cor'] },
  { code: '2Cor', en: ['2 Corinthians', '2 Cor'], ro: ['2 Corinteni', '2 Cor'] },
  { code: 'Gal', en: ['Galatians', 'Gal'], ro: ['Galateni', 'Gal'] },
  { code: 'Eph', en: ['Ephesians', 'Eph'], ro: ['Efeseni', 'Ef'] },
  { code: 'Phil', en: ['Philippians', 'Phil'], ro: ['Filipeni', 'Fil'] },
  { code: 'Col', en: ['Colossians', 'Col'], ro: ['Coloseni', 'Col'] },
  { code: '1Thess', en: ['1 Thessalonians', '1 Thess'], ro: ['1 Tesaloniceni', '1 Tes'] },
  { code: '2Thess', en: ['2 Thessalonians', '2 Thess'], ro: ['2 Tesaloniceni', '2 Tes'] },
  { code: '1Tim', en: ['1 Timothy', '1 Tim'], ro: ['1 Timotei', '1 Tim'] },
  { code: '2Tim', en: ['2 Timothy', '2 Tim'], ro: ['2 Timotei', '2 Tim'] },
  { code: 'Titus', en: ['Titus', 'Tit'], ro: ['Tit'] },
  { code: 'Phlm', en: ['Philemon', 'Philem'], ro: ['Filimon', 'Filim'], singleChapter: true },
  { code: 'Heb', en: ['Hebrews', 'Heb'], ro: ['Evrei', 'Evr'] },
  { code: 'Jas', en: ['James', 'Jas'], ro: ['Iacov', 'Iac'] },
  { code: '1Pet', en: ['1 Peter', '1 Pet'], ro: ['1 Petru', '1 Pet'] },
  { code: '2Pet', en: ['2 Peter', '2 Pet'], ro: ['2 Petru', '2 Pet'] },
  { code: '1John', en: ['1 John', '1 Jn', '1 Jno'], ro: ['1 Ioan', '1 In'] },
  { code: '2John', en: ['2 John', '2 Jn', '2 Jno'], ro: ['2 Ioan', '2 In'], singleChapter: true },
  { code: '3John', en: ['3 John', '3 Jn', '3 Jno'], ro: ['3 Ioan', '3 In'], singleChapter: true },
  { code: 'Jude', en: ['Jude'], ro: ['Iuda'], singleChapter: true },
  { code: 'Rev', en: ['Revelation', 'Revelations', 'Rev'], ro: ['Apocalipsa', 'Apoc'] },
];

/** The 66 book codes in canonical order. */
export const BOOK_CODES: readonly string[] = BOOKS.map((book) => book.code);

/**
 * Folded names that are also ordinary words ("in", "is", "job", ...). They count as a book only
 * when written with a capital letter AND followed by chapter and verse ("In. 3:16", "Job 3:1").
 */
const AMBIGUOUS_NAMES: ReadonlySet<string> = new Set([
  'in',
  'is',
  'ex',
  'col',
  'mal',
  'mica',
  'est',
  'os',
  'job',
]);

export type ReferenceLanguage = 'en' | 'ro' | 'any';

const ROMAN_PREFIX: Record<string, string> = { '1': 'i', '2': 'ii', '3': 'iii' };

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const words = (name: string): string => name.split(' ').map(escapeRegex).join('\\s+');

/** Regex source for a folded book name; "1 cor" also matches "1cor", "i cor" needs a space. */
function namePattern(name: string): string {
  const arabic = /^([123]) (.+)$/.exec(name);
  if (arabic !== null) return `${arabic[1] as string}\\s*${words(arabic[2] as string)}`;
  const roman = /^(iii|ii|i) (.+)$/.exec(name);
  if (roman !== null) return `${roman[1] as string}\\s+${words(roman[2] as string)}`;
  return words(name);
}

interface Matcher {
  /** Finds book names anywhere (global). */
  find: RegExp;
  /** Tests for a book name exactly at `lastIndex` (sticky). */
  at: RegExp;
  lookup: Map<string, BookSpec>;
}

const matchers = new Map<ReferenceLanguage, Matcher>();

function getMatcher(language: ReferenceLanguage): Matcher {
  const cached = matchers.get(language);
  if (cached !== undefined) return cached;
  const lookup = new Map<string, BookSpec>();
  for (const book of BOOKS) {
    const names =
      language === 'en' ? book.en : language === 'ro' ? book.ro : [...book.en, ...book.ro];
    for (const raw of names) {
      const name = foldText(raw.normalize('NFC'));
      // First writer wins; the unit tests pin that no two books share a name.
      if (!lookup.has(name)) lookup.set(name, book);
      const numbered = /^([123]) (.+)$/.exec(name);
      if (numbered !== null) {
        const roman = `${ROMAN_PREFIX[numbered[1] as string] as string} ${numbered[2] as string}`;
        if (!lookup.has(roman)) lookup.set(roman, book);
      }
    }
  }
  const alternation = [...lookup.keys()]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(namePattern)
    .join('|');
  const source = `(?<![\\p{L}\\p{N}])(${alternation})(?![\\p{L}\\p{N}])\\.?`;
  const matcher: Matcher = { find: new RegExp(source, 'gu'), at: new RegExp(source, 'yu'), lookup };
  matchers.set(language, matcher);
  return matcher;
}

/** "1  Cor" / "1cor" / "I  Cor" -> the key used in the lookup table ("1 cor", "i cor"). */
function bookKey(matched: string): string {
  return matched
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^([123])(?=[a-z])/, '$1 ')
    .trim();
}

/** Looks a book name up (any spelling the grammar knows); returns the book code. */
export function lookupBook(name: string, language: ReferenceLanguage = 'any'): string | undefined {
  return getMatcher(language).lookup.get(bookKey(foldText(normaliseInput(name))))?.code;
}

// ---------------------------------------------------------------------------------------------
// Numbers

const MAX_CHAPTER = 150;
const MAX_VERSE = 176;

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

function toRoman(value: number): string {
  const table: Array<[number, string]> = [
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let rest = value;
  let out = '';
  for (const [size, letters] of table) {
    while (rest >= size) {
      out += letters;
      rest -= size;
    }
  }
  return out;
}

/** Strict roman numeral in lower case, value 1..150 (no "iiii", no "ic"). */
export function parseRoman(token: string): number | null {
  if (!/^[ivxlc]{1,8}$/.test(token)) return null;
  let total = 0;
  for (let i = 0; i < token.length; i += 1) {
    const value = ROMAN_VALUES[token[i] as string] as number;
    const next = ROMAN_VALUES[token[i + 1] as string];
    total += next !== undefined && next > value ? -value : value;
  }
  if (total < 1 || total > MAX_CHAPTER) return null;
  return toRoman(total) === token ? total : null;
}

const validChapter = (value: number): boolean => value >= 1 && value <= MAX_CHAPTER;
const validVerse = (value: number): boolean => value >= 1 && value <= MAX_VERSE;

// ---------------------------------------------------------------------------------------------
// Grammar. It runs on the folded text (lower case, no diacritics); the fold keeps the length, so
// every offset is also valid in the original text.

interface Verse {
  from: number;
  to: number;
}

interface Item {
  chapter: number;
  /** Equal to `chapter` unless the item is a chapter range ("5-7"). */
  lastChapter: number;
  /** `null`: the chapter(s) as a whole. */
  verses: Verse[] | null;
  end: number;
}

function match(re: RegExp, text: string, pos: number): RegExpExecArray | null {
  re.lastIndex = pos;
  return re.exec(text);
}

const SPACES = /\s*/y;
const ARABIC = /(\d{1,3})(?!\d)/y;
const ROMAN = /([ivxlc]{1,8})(?![\p{L}\p{N}])/uy;
const CHAPTER_RANGE = /[ \t]*[-‐-―][ \t]*(\d{1,3})(?![\d:])/y;
const ARABIC_SEPARATOR = /(?::[ \t]*|[.,])(?=\d)/y;
const ROMAN_SEPARATOR = /\.?[ \t]*/y;
const VERSE =
  /(\d{1,3})[a-d]?(?![\p{L}\p{N}])(?:[ \t]*[-‐-―][ \t]*(\d{1,3})[a-d]?(?![\p{L}\p{N}]))?(?:[ \t]*(?:ff?|sqq?)(?![\p{L}\p{N}])\.?)?/uy;
const LIST_COMMA = /[ \t]*,[ \t]*/y;
const CONTINUATION = /[ \t]*[;,][ \t]*/y;

function skipSpaces(text: string, pos: number): number {
  return pos + (match(SPACES, text, pos)?.[0].length ?? 0);
}

/** "17", "17-19", "3, 5", "17ff": the verse list that follows a chapter. */
function parseVerses(
  folded: string,
  start: number,
  matcher: Matcher,
): { verses: Verse[]; end: number } | null {
  const verses: Verse[] = [];
  let pos = start;
  for (;;) {
    const item = match(VERSE, folded, pos);
    if (item === null) break;
    const from = Number(item[1]);
    const to = item[2] !== undefined ? Number(item[2]) : from;
    if (!validVerse(from) || !validVerse(to) || to < from) break;
    verses.push({ from, to });
    pos += item[0].length;
    // "3, 5" continues the list, unless the number opens another citation ("1 Cor. xv") or is
    // the chapter of a chapter:verse pair ("19:3").
    const comma = match(LIST_COMMA, folded, pos);
    if (comma === null) break;
    const next = pos + comma[0].length;
    if (!/\d/.test(folded[next] ?? '')) break;
    matcher.at.lastIndex = next;
    if (matcher.at.test(folded)) break;
    if (/^\d{1,3}:\d/.test(folded.slice(next, next + 8))) break;
    pos = next;
  }
  return verses.length === 0 ? null : { verses, end: pos };
}

/** One `chapter[ separator verses]` item: `4:17`, `4.17`, `4,17`, `iv. 17`, `23`, `xiii`, `5-7`. */
function parseItem(folded: string, pos: number, matcher: Matcher): Item | null {
  const arabic = match(ARABIC, folded, pos);
  if (arabic !== null) {
    const chapter = Number(arabic[1]);
    if (!validChapter(chapter)) return null;
    const end = pos + arabic[0].length;
    const range = match(CHAPTER_RANGE, folded, end);
    if (range !== null) {
      const lastChapter = Number(range[1]);
      if (validChapter(lastChapter) && lastChapter > chapter && lastChapter - chapter <= 8) {
        return { chapter, lastChapter, verses: null, end: end + range[0].length };
      }
    }
    const separator = match(ARABIC_SEPARATOR, folded, end);
    if (separator !== null) {
      const list = parseVerses(folded, end + separator[0].length, matcher);
      if (list !== null)
        return { chapter, lastChapter: chapter, verses: list.verses, end: list.end };
    }
    return { chapter, lastChapter: chapter, verses: null, end };
  }
  const roman = match(ROMAN, folded, pos);
  if (roman === null) return null;
  const token = roman[1] as string;
  const chapter = parseRoman(token);
  if (chapter === null) return null;
  const end = pos + roman[0].length;
  const separator = match(ROMAN_SEPARATOR, folded, end);
  const list = parseVerses(folded, end + (separator?.[0].length ?? 0), matcher);
  if (list !== null) return { chapter, lastChapter: chapter, verses: list.verses, end: list.end };
  // A lone "i", "v" or "x" after a book name is far more likely a word or a letter.
  return token.length >= 2 ? { chapter, lastChapter: chapter, verses: null, end } : null;
}

export interface ParseOptions {
  /** Which book names to know. Use the language of the text; `any` for user questions. */
  language?: ReferenceLanguage;
}

/**
 * Finds the scripture references in `input`. Offsets refer to the NFC-normalised text, which is
 * returned as `text` so that callers can cut the references out of the very same string.
 */
export function parseReferences(
  input: string,
  options: ParseOptions = {},
): { text: string; refs: ParsedRef[] } {
  const text = normaliseInput(input);
  const folded = foldText(text);
  const matcher = getMatcher(options.language ?? 'any');
  const refs: ParsedRef[] = [];
  let cursor = 0;
  matcher.find.lastIndex = 0;
  for (const found of folded.matchAll(matcher.find)) {
    const index = found.index ?? 0;
    if (index < cursor) continue;
    const key = bookKey(found[1] as string);
    const book = matcher.lookup.get(key);
    if (book === undefined) continue;
    const first = parseItem(folded, skipSpaces(folded, index + found[0].length), matcher);
    if (first === null) continue;

    const startsUpper = /\p{Lu}/u.test(text[index] ?? '');
    const hasVerses = first.verses !== null;
    if (!startsUpper && !hasVerses) continue; // "numbers 5" in running text
    if (AMBIGUOUS_NAMES.has(key) && !(startsUpper && hasVerses)) continue;

    // The rest of the run: "; xviii. 36", "; 18:36", ", vi. 5". Continuations need verses.
    const items: Item[] = [first];
    let end = first.end;
    for (;;) {
      const separator = match(CONTINUATION, folded, end);
      if (separator === null) break;
      const next = end + separator[0].length;
      matcher.at.lastIndex = next;
      if (matcher.at.test(folded)) break; // the next citation names its own book
      const item = parseItem(folded, next, matcher);
      if (item === null || item.verses === null) break;
      items.push(item);
      end = item.end;
    }

    for (const item of items) {
      let { chapter, lastChapter, verses } = item;
      if (book.singleChapter === true && verses === null) {
        // "Jude 5" and "Jude 5-7" are verses of the only chapter.
        verses = [{ from: chapter, to: lastChapter }];
        chapter = 1;
        lastChapter = 1;
      }
      for (let c = chapter; c <= lastChapter; c += 1) {
        if (verses === null) {
          refs.push({ book: book.code, chapter: c, from: null, to: null, start: index, end });
        } else {
          for (const verse of verses) {
            refs.push({
              book: book.code,
              chapter: c,
              from: verse.from,
              to: verse.to,
              start: index,
              end,
            });
          }
        }
      }
    }
    cursor = end;
  }
  return { text, refs };
}

/** `Matt 4:17`, `Matt 4:17-19`, `Ps 23`: the canonical rendering (logs and tests). */
export function refKey(ref: ScriptureRef): string {
  if (ref.from === null) return `${ref.book} ${ref.chapter}`;
  return `${ref.book} ${ref.chapter}:${ref.from}${ref.to !== ref.from ? `-${ref.to}` : ''}`;
}

/** The references as plain triples (no offsets), without duplicates, in order of appearance. */
export function extractReferences(text: string, options: ParseOptions = {}): ScriptureRef[] {
  const seen = new Set<string>();
  const out: ScriptureRef[] = [];
  for (const ref of parseReferences(text, options).refs) {
    const key = refKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ book: ref.book, chapter: ref.chapter, from: ref.from, to: ref.to });
  }
  return out;
}

/** Key of the (book, chapter) bucket used by the retrieval index. */
export function chapterKey(ref: Pick<ScriptureRef, 'book' | 'chapter'>): string {
  return `${ref.book}|${ref.chapter}`;
}

/**
 * How strongly a reference found in a paragraph answers a reference in the question, 0..1:
 * the same verse (or an overlapping range) is 1, the same chapter weaker.
 */
export function refMatchWeight(wanted: ScriptureRef, found: ScriptureRef): number {
  if (wanted.book !== found.book || wanted.chapter !== found.chapter) return 0;
  if (wanted.from === null || wanted.to === null) {
    return found.from === null ? 1 : 0.6; // asked about a chapter; the paragraph cites a verse of it
  }
  if (found.from === null || found.to === null) return 0.35; // asked about a verse; paragraph cites the chapter
  const overlap = wanted.to >= found.from && found.to >= wanted.from;
  return overlap ? 1 : 0.2; // same chapter, other verses: related, not the same text
}

/** Replaces the character ranges with a space each (the ranges may overlap). */
export function cutRanges(
  text: string,
  ranges: ReadonlyArray<{ start: number; end: number }>,
): string {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const range of sorted) {
    if (range.end <= cursor) continue;
    if (range.start > cursor) out += text.slice(cursor, range.start);
    out += ' ';
    cursor = range.end;
  }
  return out + text.slice(cursor);
}
