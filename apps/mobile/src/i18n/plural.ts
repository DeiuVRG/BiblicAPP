import type { UiLanguage } from './language';

// Plural categories and counts (docs/ui-spec-v2.md, section 17.2). Hermes (the JavaScript engine of
// iOS and Android builds) has no `Intl.PluralRules`, so the CLDR rules of the two languages of the
// product are written by hand; a Jest test compares them with `Intl.PluralRules` on Node, which has
// them, for n = 0 to 1000. `count` is the only way a count is written next to its noun.

/** The plural categories the two languages use: English has `one` and `other`, Romanian also `few`. */
export type PluralCategory = 'one' | 'few' | 'other';

/** A no-break space: a number never separates from its unit across a line break. */
export const NBSP = ' ';

/**
 * The CLDR cardinal category of a number. Romanian: `one` when n is 1; `few` when n is 0 or, for a
 * n that is not 1, when n mod 100 is in 1 to 19 (a decimal is `few` too); otherwise `other`, which
 * takes "de" (20 de lucrări). English: `one` when n is 1, otherwise `other`.
 */
export function pluralCategory(n: number, language: UiLanguage): PluralCategory {
  const value = Math.abs(n);
  if (language === 'en') return value === 1 ? 'one' : 'other';
  if (value === 1) return 'one';
  if (!Number.isInteger(value)) return 'few';
  const rest = value % 100;
  return value === 0 || (rest >= 1 && rest <= 19) ? 'few' : 'other';
}

/** The forms of a noun by category; `few` may be left out where the language has none. */
export interface PluralForms {
  one: string;
  few?: string;
  other: string;
}

/** An integer with thousands separators: a point in Romanian, a comma in English. */
export function formatNumber(n: number, language: UiLanguage): string {
  if (!Number.isFinite(n)) return String(n);
  const [whole = '', fraction] = String(Math.abs(n)).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, language === 'ro' ? '.' : ',');
  const decimals = fraction === undefined ? '' : `${language === 'ro' ? ',' : '.'}${fraction}`;
  return `${n < 0 ? '-' : ''}${grouped}${decimals}`;
}

/**
 * A count with its noun: `count(1, forms, 'ro')` is "1 lucrare", 12 is "12 lucrări" and 20 is "20 de
 * lucrări" for `{ one: 'lucrare', few: 'lucrări', other: 'de lucrări' }`. A no-break space follows
 * the number.
 */
export function count(n: number, forms: PluralForms, language: UiLanguage): string {
  const category = pluralCategory(n, language);
  const form =
    category === 'one' ? forms.one : category === 'few' ? (forms.few ?? forms.other) : forms.other;
  return `${formatNumber(n, language)}${NBSP}${form}`;
}
