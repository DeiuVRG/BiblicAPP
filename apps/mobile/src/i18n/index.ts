// There is no static `t` on purpose: the interface language is a setting, so components read the
// strings with `useT()` (they re-render when the language changes) and plain functions take the
// table as a parameter (see labels.ts).
export { I18nProvider, useT, useUiLanguage } from './i18n-context';
export { stringsFor } from './tables';
export type { Strings } from './strings';
export type { ReadingLanguage, UiLanguage, UiLanguagePreference } from './language';
