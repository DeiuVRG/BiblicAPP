import type { EditionSummary } from '@/content/types';
import { baseLanguage } from '@/i18n/language';
import type { ReadingLanguage } from '@/i18n/language';

// Which editions of a work the reader can show, and which two it shows side by side
// (docs/ui-spec-v2.md, 8.2 and 8.5). An edition is named in a pair by its language code ("ro", "en")
// or, for the source edition when its language is neither of the two reading languages (the Latin of
// Augustine), by "orig". `?pair=ro+en` in the address and `settings.readerPair` use that notation.

/** The token of an edition: "ro", "en", "orig" (a source in another language) or its own code. */
export function editionToken(edition: Pick<EditionSummary, 'language' | 'kind'>): string {
  const language = baseLanguage(edition.language);
  if (language === 'ro' || language === 'en') return language;
  return edition.kind === 'source' ? 'orig' : language;
}

export interface LangChoice {
  /** "ro", "en", "orig". */
  token: string;
  /** What the control writes: "RO", "EN", and "Original" for the source in another language. */
  code: string;
  edition: EditionSummary;
}

const TOKEN_ORDER = ['ro', 'en', 'orig'];

/**
 * The editions as the choices of the language control: Romanian, English, then the original. An
 * edition whose language is none of these and is not the source has no place in the control.
 */
export function languageChoices(editions: readonly EditionSummary[]): LangChoice[] {
  const choices: LangChoice[] = [];
  for (const edition of editions) {
    const token = editionToken(edition);
    if (!TOKEN_ORDER.includes(token) || choices.some((choice) => choice.token === token)) continue;
    choices.push({ token, code: token === 'orig' ? 'Original' : token.toUpperCase(), edition });
  }
  return choices.sort((a, b) => TOKEN_ORDER.indexOf(a.token) - TOKEN_ORDER.indexOf(b.token));
}

export interface PairChoice {
  /** "ro+en". */
  pair: string;
  first: LangChoice;
  second: LangChoice;
}

/**
 * The pairs that can be read side by side, the reading language first inside each: "ro+en" with two
 * editions; with three also "ro+orig" and "en+orig" (in the order of the reading language).
 */
export function pairChoices(
  editions: readonly EditionSummary[],
  readingLanguage: ReadingLanguage,
): PairChoice[] {
  const ordered = languageChoices(editions).sort((a, b) => {
    const rank = (choice: LangChoice) =>
      choice.token === readingLanguage ? 0 : TOKEN_ORDER.indexOf(choice.token) + 1;
    return rank(a) - rank(b);
  });
  const pairs: PairChoice[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const first = ordered[i]!;
      const second = ordered[j]!;
      pairs.push({ pair: `${first.token}+${second.token}`, first, second });
    }
  }
  return pairs;
}

/** The two editions a pair names, or null when the pair is malformed or one of them is not installed. */
export function resolvePair(
  pair: string | null | undefined,
  editions: readonly EditionSummary[],
): { first: EditionSummary; second: EditionSummary; pair: string } | null {
  if (!pair) return null;
  const [a, b] = pair.split('+');
  if (!a || !b || a === b) return null;
  const choices = languageChoices(editions);
  const first = choices.find((choice) => choice.token === a);
  const second = choices.find((choice) => choice.token === b);
  return first && second ? { first: first.edition, second: second.edition, pair } : null;
}

/**
 * The pair a reader gets when they switch the two lanes on: the one remembered for the work, else the
 * default of the settings, else the first pair on offer (the reading language first), when it is
 * installed here. Null for a work with one edition.
 */
export function initialPair(
  editions: readonly EditionSummary[],
  readingLanguage: ReadingLanguage,
  remembered: string | null,
  preferred: string | null,
): string | null {
  for (const candidate of [remembered, preferred]) {
    // The two orders of one pair are one pair: "en+ro" is "ro+en" with the lanes swapped; keep it.
    if (resolvePair(candidate, editions)) return candidate;
  }
  return pairChoices(editions, readingLanguage)[0]?.pair ?? null;
}
