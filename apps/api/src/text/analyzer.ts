import { foldText, normaliseInput } from './fold';
import { stemEnglish, stemRomanian } from './stem';
import { ENGLISH_STOPWORDS, ROMANIAN_STOPWORDS } from './stopwords';

/** `ro-MD` -> `ro`. */
export function baseLanguage(code: string): string {
  return (code.split(/[-_]/)[0] ?? code).toLowerCase();
}

/** One word of a text: as folded, and as a search term (`null` for a stop word or a lone letter). */
export interface AnalyzedToken {
  token: string;
  term: string | null;
}

export interface Analyzer {
  /** Base language this analyzer was built for ("ro", "en" or "other"). */
  readonly language: string;
  /** Content terms in order of appearance: folded, stop words removed, stemmed. */
  analyze(text: string): string[];
  /** Every word of the text in order of appearance, with the term it becomes (or `null`). */
  tokenize(text: string): AnalyzedToken[];
}

const TOKEN = /[\p{L}\p{N}]+/gu;

function createAnalyzer(
  language: string,
  stopwords: ReadonlySet<string>,
  stem: (word: string) => string,
): Analyzer {
  const tokenize = (text: string): AnalyzedToken[] => {
    // "God's kingdom" -> "God kingdom"; the possessive is not a term.
    const folded = foldText(normaliseInput(text)).replace(/'s\b/g, '');
    const tokens: AnalyzedToken[] = [];
    for (const match of folded.matchAll(TOKEN)) {
      const token = match[0];
      const dropped = (token.length < 2 && !/\d/.test(token)) || stopwords.has(token);
      tokens.push({ token, term: dropped ? null : stem(token) });
    }
    return tokens;
  };
  return {
    language,
    tokenize,
    analyze(text: string): string[] {
      const terms: string[] = [];
      for (const { term } of tokenize(text)) if (term !== null) terms.push(term);
      return terms;
    },
  };
}

const NO_STOPWORDS: ReadonlySet<string> = new Set();

const ANALYZERS: Record<string, Analyzer> = {
  ro: createAnalyzer('ro', ROMANIAN_STOPWORDS, stemRomanian),
  en: createAnalyzer('en', ENGLISH_STOPWORDS, stemEnglish),
};
const GENERIC = createAnalyzer('other', NO_STOPWORDS, (word) => word);

/** The analyzer for an edition language; unknown languages get plain folding without stop words. */
export function getAnalyzer(language: string): Analyzer {
  return ANALYZERS[baseLanguage(language)] ?? GENERIC;
}
