import { en } from './en';
import { ro } from './ro';
import type { Strings } from './strings';
import type { UiLanguage } from './language';

/** The string table of an interface language. */
export function stringsFor(language: UiLanguage): Strings {
  return language === 'en' ? en : ro;
}
