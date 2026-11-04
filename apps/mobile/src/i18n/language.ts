// The two languages of the product and how a device locale maps onto them. Pure module (no React,
// no string tables): the settings, the repository and the i18n context all import it.

/** Language of the edition that opens first (the "reading language"). */
export type ReadingLanguage = 'ro' | 'en';

/** Language of the interface once it is resolved. */
export type UiLanguage = 'ro' | 'en';

/** What the user chooses for the interface: a language, or "follow the device". */
export type UiLanguagePreference = 'system' | UiLanguage;

export const READING_LANGUAGES: readonly ReadingLanguage[] = ['ro', 'en'];
export const UI_LANGUAGE_PREFERENCES: readonly UiLanguagePreference[] = ['system', 'ro', 'en'];

/**
 * The reading language of a repository call that names none, so that the primary edition follows
 * the fallback order of the spec (ro, en, the source edition). It says nothing about the device:
 * that is `languageFromLocale`.
 */
export const FALLBACK_LANGUAGE: ReadingLanguage = 'ro';

/** "en-GB" and "EN" are "en": the language subtag of a BCP 47 code, lower-cased. */
export function baseLanguage(code: string): string {
  return (code.split(/[-_]/)[0] ?? '').toLowerCase();
}

/**
 * The product language for a device locale: "ro" when the device is Romanian, "en" for every other
 * device, one whose locale cannot be read included (the rule of the spec: "ro when the device is
 * Romanian, else en").
 */
export function languageFromLocale(locale: string | null | undefined): ReadingLanguage {
  return typeof locale === 'string' && baseLanguage(locale.trim()) === 'ro' ? 'ro' : 'en';
}

/** The interface language for the user's choice and the device locale. */
export function resolveUiLanguage(
  preference: UiLanguagePreference,
  deviceLocale: string | null | undefined,
): UiLanguage {
  return preference === 'system' ? languageFromLocale(deviceLocale) : preference;
}
