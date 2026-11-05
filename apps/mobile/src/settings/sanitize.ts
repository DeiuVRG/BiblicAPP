import { READING_LANGUAGES, UI_LANGUAGE_PREFERENCES } from '@/i18n/language';
import type { ReadingLanguage, UiLanguagePreference } from '@/i18n/language';
import { READING_FONTS } from '@/theme/font-families';
import type { ReadingFont } from '@/theme/font-families';
import type { ThemePreference } from '@/theme/palettes';

import {
  DEFAULT_SETTINGS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_SPACING_NAMES,
  THEME_PREFERENCES,
} from './types';
import type { LineSpacing, LineSpacingPreset, ReaderSettings } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundLineHeight(value: number): number {
  return Math.round(clamp(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX) * 10) / 10;
}

/** Two language codes or "orig", joined by a plus: "ro+en", "ro+orig", "en+la". */
const PAIR = /^(?:[a-z]{2,3}|orig)\+(?:[a-z]{2,3}|orig)$/;

/** Whether `value` is a well-formed reading pair ("ro+en"): two different parts. */
export function isReaderPair(value: unknown): value is string {
  if (typeof value !== 'string' || !PAIR.test(value)) return false;
  const [first, second] = value.split('+');
  return first !== second;
}

function sanitizeLineSpacing(source: Record<string, unknown>, fallback: LineSpacing): LineSpacing {
  const own = source.lineSpacing;
  if (LINE_SPACING_NAMES.includes(own as LineSpacingPreset)) return own as LineSpacingPreset;
  // The number of the stepper, and what an older version stored under `lineHeight`.
  const number = typeof own === 'number' ? own : source.lineHeight;
  return typeof number === 'number' && Number.isFinite(number) ? roundLineHeight(number) : fallback;
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
      : source.fontSize === null
        ? null
        : defaults.fontSize;
  const lineSpacing = sanitizeLineSpacing(source, defaults.lineSpacing);
  const theme = THEME_PREFERENCES.includes(source.theme as ThemePreference)
    ? (source.theme as ThemePreference)
    : defaults.theme;
  const readingFont = READING_FONTS.includes(source.readingFont as ReadingFont)
    ? (source.readingFont as ReadingFont)
    : defaults.readingFont;
  const readingLanguage = READING_LANGUAGES.includes(source.readingLanguage as ReadingLanguage)
    ? (source.readingLanguage as ReadingLanguage)
    : defaults.readingLanguage;
  const uiLanguage = UI_LANGUAGE_PREFERENCES.includes(source.uiLanguage as UiLanguagePreference)
    ? (source.uiLanguage as UiLanguagePreference)
    : defaults.uiLanguage;
  const readerPair =
    source.readerPair === null
      ? null
      : isReaderPair(source.readerPair)
        ? source.readerPair
        : defaults.readerPair;
  return {
    fontSize,
    lineSpacing,
    theme,
    readingFont,
    readingLanguage,
    uiLanguage,
    readerPair,
  };
}
