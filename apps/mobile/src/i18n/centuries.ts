import type { UiLanguage } from './language';

// Centuries as the two languages write them (docs/ui-spec-v2.md, section 17.3): Romanian "sec. V"
// (short) and "secolul al V-lea" (long, the first is "secolul I"), English "5th century"; before
// Christ "î.Hr." and "BC". A century is a number: 4 is the 4th century (the years 301 to 400),
// -5 is the 5th century before Christ.

/** The century of a year: 354 is 4, 1903 is 20, 100 is 1, and years before Christ are negative. */
export function centuryOfYear(year: number): number {
  if (year > 0) return Math.ceil(year / 100);
  if (year < 0) return -Math.ceil(-year / 100);
  return 1;
}

const ROMAN: readonly (readonly [number, string])[] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** A whole number from 1 to 3999 in Roman numerals; anything else as it is. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  let rest = n;
  let result = '';
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      result += symbol;
      rest -= value;
    }
  }
  return result;
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st: the English ordinal of a whole number. */
export function englishOrdinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export type CenturyStyle = 'short' | 'long';

/**
 * "sec. V", "secolul al V-lea" (the first one: "secolul I"), "5th century"; a negative century is
 * before Christ ("sec. V î.Hr.", "5th century BC"). English writes one form for both styles.
 */
export function formatCentury(century: number, language: UiLanguage, style: CenturyStyle): string {
  const before = century < 0;
  const n = Math.abs(century);
  if (language === 'en') return `${englishOrdinal(n)} century${before ? ' BC' : ''}`;
  const suffix = before ? ' î.Hr.' : '';
  if (style === 'short') return `sec. ${toRoman(n)}${suffix}`;
  return n === 1 ? `secolul I${suffix}` : `secolul al ${toRoman(n)}-lea${suffix}`;
}
