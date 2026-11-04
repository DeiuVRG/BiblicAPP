import { READING_LANGUAGES, UI_LANGUAGE_PREFERENCES } from '@/i18n/language';
import type { ReadingLanguage, UiLanguagePreference } from '@/i18n/language';
import type { ThemePreference } from '@/theme/palettes';

import {
  DEFAULT_SETTINGS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  THEME_PREFERENCES,
} from './types';
import type { ReaderSettings } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundLineHeight(value: number): number {
  return Math.round(clamp(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX) * 10) / 10;
}

/**
 * Turns untrusted stored data into valid settings; invalid or missing fields (settings saved
 * before a field existed have no language) fall back to `defaults`.
 */
export function sanitizeSettings(
  raw: unknown,
  defaults: ReaderSettings = DEFAULT_SETTINGS,
): ReaderSettings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const fontSize =
    typeof source.fontSize === 'number' && Number.isFinite(source.fontSize)
      ? Math.round(clamp(source.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
      : defaults.fontSize;
  const lineHeight =
    typeof source.lineHeight === 'number' && Number.isFinite(source.lineHeight)
      ? roundLineHeight(source.lineHeight)
      : defaults.lineHeight;
  const theme = THEME_PREFERENCES.includes(source.theme as ThemePreference)
    ? (source.theme as ThemePreference)
    : defaults.theme;
  const readingLanguage = READING_LANGUAGES.includes(source.readingLanguage as ReadingLanguage)
    ? (source.readingLanguage as ReadingLanguage)
    : defaults.readingLanguage;
  const uiLanguage = UI_LANGUAGE_PREFERENCES.includes(source.uiLanguage as UiLanguagePreference)
    ? (source.uiLanguage as UiLanguagePreference)
    : defaults.uiLanguage;
  return { fontSize, lineHeight, theme, readingLanguage, uiLanguage };
}
