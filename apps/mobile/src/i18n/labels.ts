import { baseLanguage } from './language';
import type { UiLanguage } from './language';
import type { Strings } from './strings';

// Pure label helpers: they take the string table as a parameter, so they work outside React and
// follow the interface language of whoever calls them.

/** Name of a language code in the interface language, falling back to the upper-cased code. */
export function languageName(code: string, t: Strings): string {
  const names: Readonly<Record<string, string>> = t.languageNames;
  return names[code.toLowerCase()] ?? names[baseLanguage(code)] ?? code.toUpperCase();
}

/**
 * The language of an edition as a label. The two reading languages are written in their own
 * language in every interface ("Română", "English", as in any language picker); another language
 * ("Latină", "Latin") is named in the interface language.
 */
export function editionLanguageLabel(code: string, t: Strings): string {
  const reading: Readonly<Record<string, string>> = t.readingLanguages;
  return reading[baseLanguage(code)] ?? languageName(code, t);
}

/** "Română · traducere", "English · original": the language of an edition and what it is. */
export function editionLabel(
  edition: { language: string; kind: keyof Strings['editionKind'] },
  t: Strings,
): string {
  return `${editionLanguageLabel(edition.language, t)} · ${t.editionKind[edition.kind].toLowerCase()}`;
}

/**
 * "sec. V" / "secolul al V-lea" (long, first: "secolul I") in Romanian, "5th century" in English; a
 * negative century is before Christ. An empty string for an unknown century.
 */
export function formatCenturyLabel(
  century: number | null | undefined,
  t: Strings,
  style: 'short' | 'long' = 'short',
): string {
  if (century == null) return '';
  return style === 'long' ? t.dates.centuryLong(century) : t.dates.centuryShort(century);
}

/** "1903", "5 î.Hr." / "5 BC" or an empty string for unknown years. */
export function formatYear(year: number | null | undefined, t: Strings): string {
  if (year == null) return '';
  return year < 0 ? t.dates.bc(-year) : String(year);
}

/** "1862–1949", "n. 1862" / "b. 1862", "m. 1949" / "d. 1949" or an empty string. */
export function formatLifespan(
  born: number | null | undefined,
  died: number | null | undefined,
  t: Strings,
): string {
  if (born != null && died != null) return `${formatYear(born, t)}–${formatYear(died, t)}`;
  if (born != null) return t.dates.born(formatYear(born, t));
  if (died != null) return t.dates.died(formatYear(died, t));
  return '';
}

export const licenceLabel = (status: keyof Strings['licenceStatus'], t: Strings): string =>
  t.licenceStatus[status];

export const editionKindLabel = (kind: keyof Strings['editionKind'], t: Strings): string =>
  t.editionKind[kind];

/**
 * The licence note in the language of the interface: `noteRo` or `noteEn` when the pack has it,
 * the note in the edition's own language otherwise.
 */
export function licenceNote(
  licence: { note: string; noteRo?: string; noteEn?: string },
  language: UiLanguage,
): string {
  const translated = language === 'ro' ? licence.noteRo : licence.noteEn;
  return translated !== undefined && translated.trim() !== '' ? translated : licence.note;
}

/**
 * "5 noiembrie 2026" / "5 November 2026" from an ISO date or date-time ("2026-11-05",
 * "2026-11-05T02:08:41Z"); an empty string when it is not one.
 */
export function formatDateLong(iso: string | null | undefined, t: Strings): string {
  const match = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!match) return '';
  const month = t.dates.months[Number(match[2]) - 1];
  if (month === undefined) return '';
  return t.dates.long(Number(match[3]), month, Number(match[1]));
}
