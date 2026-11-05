import { UsageError } from '../lib/usage-error';

/**
 * The languages of the translation pipeline (docs/traducere-pipeline.md, sections 1.1 and 4).
 *
 * - Target languages are the two the library is read in: `ro` and `en`. Every material file, every
 *   typographic rule and every notation of scripture references is per target language.
 * - Source languages that the checks know are `en`, `la` and `grc`: each has a list of function
 *   words (`RESIDUE_*`), `en` and `la` a grammar of scripture references. A source in another
 *   language still gets jobs, without references, and is not checked for residue.
 * - Length bands (`LENGTH_RATIO`) are per pair of languages.
 *
 * Pure data and small functions; nothing here reads a file.
 */

export const TARGET_LANGUAGES = ['ro', 'en'] as const;
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];

export const SOURCE_LANGUAGES = ['en', 'la', 'grc'] as const;
export type SourceLanguage = (typeof SOURCE_LANGUAGES)[number];

/** `en-GB` is `en`: everything here is keyed by the primary subtag. */
export function primaryLanguage(code: string): string {
  return code.toLowerCase().split('-')[0] ?? code.toLowerCase();
}

export function isTargetLanguage(code: string): code is TargetLanguage {
  return (TARGET_LANGUAGES as readonly string[]).includes(code);
}

export function isSourceLanguage(code: string): code is SourceLanguage {
  return (SOURCE_LANGUAGES as readonly string[]).includes(primaryLanguage(code));
}

/** The field of a `TranslationOutput` that carries the translated heading of a section. */
export type HeadingField = 'headingRo' | 'headingEn';

export interface TargetSpec {
  code: TargetLanguage;
  /** `headingRo` for Romanian, `headingEn` for English (required in part 0 of a section). */
  headingField: HeadingField;
  /**
   * Romanian s and t with a cedilla are replaced by the comma-below letters (the one defect that
   * `--fix` repairs that is specific to a language). Not applied to English.
   */
  cedilla: boolean;
  /** Quotation marks of the language: `„…”` and `«…»` for Romanian, `“…”` and `‘…’` for English. */
  quotes: 'ro' | 'en';
  /** Notation of scripture references in the translation: `Mat. 4:17` or `Matt. 4:17`. */
  notation: 'ro' | 'en';
}

const TARGETS: Record<TargetLanguage, TargetSpec> = {
  ro: { code: 'ro', headingField: 'headingRo', cedilla: true, quotes: 'ro', notation: 'ro' },
  en: { code: 'en', headingField: 'headingEn', cedilla: false, quotes: 'en', notation: 'en' },
};

/** The spec of a target language; a language the pipeline has no materials for is a usage error. */
export function targetSpec(code: string): TargetSpec {
  if (!isTargetLanguage(code)) {
    throw new UsageError(
      `"${code}" is not a supported target language (supported: ${TARGET_LANGUAGES.join(', ')})`,
    );
  }
  return TARGETS[code];
}

export function headingFieldFor(code: string): HeadingField {
  return targetSpec(code).headingField;
}

// ---------------------------------------------------------------------------------------------
// Greek

/**
 * Greek folded for comparison with a list of function words: decomposed (NFD), without accents,
 * breathings and the iota subscript, lower case, one form of sigma. Only used to look words up;
 * the Greek of a text is never changed, and never transliterated.
 */
export function foldGreek(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\u03C2/g, '\u03C3');
}

// ---------------------------------------------------------------------------------------------
// Residue of the source language (RESIDUE_EN, RESIDUE_LA, RESIDUE_GRC)

export type ResidueCode = 'RESIDUE_EN' | 'RESIDUE_LA' | 'RESIDUE_GRC';

export interface ResidueSpec {
  code: ResidueCode;
  /** The language, for messages. */
  name: string;
  /** Latin script words (ASCII letters only) or Greek script words (compared folded). */
  script: 'latin' | 'greek';
  /** Function words after `ignore` has been applied; Greek words are folded. */
  words: ReadonlySet<string>;
}

// prettier-ignore
const ENGLISH_FUNCTION_WORDS = [
  'the', 'and', 'of', 'which', 'that', 'with', 'this', 'is', 'not', 'from', 'by', 'his',
  'their', 'been', 'were', 'into', 'than', 'those', 'these', 'there', 'what', 'when', 'would',
  'should', 'also', 'only', 'but', 'upon', 'through', 'between', 'because', 'however',
];

// prettier-ignore
const LATIN_FUNCTION_WORDS = [
  'et', 'in', 'ad', 'non', 'quod', 'est', 'sed', 'enim', 'autem', 'cum', 'ut', 'qui', 'quae',
  'ac', 'atque', 'nec', 'neque',
];

// The article, the commonest prepositions and the conjunction, as the specification lists them.
const GREEK_FUNCTION_WORDS = ['καὶ', 'τοῦ', 'τῆς', 'τὸν', 'τὴν', 'ἐν', 'εἰς', 'διὰ'];

/**
 * Words of the Latin list that are also words, or the first part of a compound, in the target
 * language, so that they cannot count as untranslated Latin: `in`, `ad hoc`, `et al.`, `non-` in
 * English; `cum` (how), `est` (east), `ac` (needle), `in` (flax) and the prefix `non-` in
 * Romanian. Nothing is ignored for the English list in a Romanian text.
 */
const IGNORED_IN_TARGET: Record<string, Record<TargetLanguage, readonly string[]>> = {
  la: { en: ['in', 'ad', 'et', 'non'], ro: ['cum', 'est', 'ac', 'in', 'non'] },
  en: { en: [], ro: [] },
  grc: { en: [], ro: [] },
};

/**
 * The function words that tell untranslated source language in a translation, for a pair of
 * languages. `null` when the source language has no list (or is the target language itself).
 */
export function residueSpec(sourceLanguage: string, targetLanguage: string): ResidueSpec | null {
  const key = `${primaryLanguage(sourceLanguage)}>${primaryLanguage(targetLanguage)}`;
  const cached = RESIDUE_CACHE.get(key);
  if (cached !== undefined) return cached;
  const built = buildResidueSpec(primaryLanguage(sourceLanguage), primaryLanguage(targetLanguage));
  RESIDUE_CACHE.set(key, built);
  return built;
}

const RESIDUE_CACHE = new Map<string, ResidueSpec | null>();

function buildResidueSpec(source: string, target: string): ResidueSpec | null {
  if (source === target) return null;
  const ignored = new Set(
    isTargetLanguage(target) ? (IGNORED_IN_TARGET[source]?.[target] ?? []) : [],
  );
  const keep = (words: readonly string[]): string[] => words.filter((w) => !ignored.has(w));
  switch (source) {
    case 'en':
      return {
        code: 'RESIDUE_EN',
        name: 'English',
        script: 'latin',
        words: new Set(keep(ENGLISH_FUNCTION_WORDS)),
      };
    case 'la':
      return {
        code: 'RESIDUE_LA',
        name: 'Latin',
        script: 'latin',
        words: new Set(keep(LATIN_FUNCTION_WORDS)),
      };
    case 'grc':
      return {
        code: 'RESIDUE_GRC',
        name: 'Greek',
        script: 'greek',
        words: new Set(GREEK_FUNCTION_WORDS.map(foldGreek)),
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Length bands (LENGTH_RATIO)

/** Ratio of the characters of the translation to the characters of the source paragraph. */
export interface LengthBands {
  /** Below this ratio, or above `majorHigh`, the finding is MAJOR. */
  majorLow: number;
  majorHigh: number;
  /** Below this ratio, or above `minorHigh`, the finding is MINOR. */
  minorLow: number;
  minorHigh: number;
}

/** English to Romanian, the pair the pipeline was built for (Vos: 0.93 to 1.15, median 1.04). */
const EN_RO_BANDS: LengthBands = {
  majorLow: 0.75,
  majorHigh: 1.6,
  minorLow: 0.85,
  minorHigh: 1.45,
};

/**
 * Bands per pair `source>target`; docs/traducere-pipeline.md, section 4.2 has the measurements
 * behind them. Latin is compact: the English of a Latin paragraph is 1.25 to 1.3 times as long in
 * characters and its Romanian the same (Augustine, De spiritu et littera 1.1: 1,369 characters of
 * Latin, 1,749 in the English translation of 1887, 1,724 and 1,708 in the English and Romanian
 * fixtures), up to 1.6 for a looser rendering, so the bands sit around 1.1 to 2.0. Greek is about
 * as long as its English and Romanian (the Creed of Constantinople: 0.99 to 1.27 over its three
 * articles), so Greek keeps the bands of the pair the pipeline was built for.
 */
const BANDS: Record<string, LengthBands> = {
  'en>ro': EN_RO_BANDS,
  'la>en': { majorLow: 1.0, majorHigh: 2.2, minorLow: 1.1, minorHigh: 1.9 },
  'la>ro': { majorLow: 1.0, majorHigh: 2.3, minorLow: 1.1, minorHigh: 2.0 },
  'grc>en': EN_RO_BANDS,
  'grc>ro': EN_RO_BANDS,
};

export function lengthBands(sourceLanguage: string, targetLanguage: string): LengthBands {
  return (
    BANDS[`${primaryLanguage(sourceLanguage)}>${primaryLanguage(targetLanguage)}`] ?? EN_RO_BANDS
  );
}
