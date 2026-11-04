import { getDeviceLocale } from '@/i18n/device-locale';
import { languageFromLocale } from '@/i18n/language';
import type { ReadingLanguage, UiLanguagePreference } from '@/i18n/language';
import type { ReadingFont } from '@/theme/font-families';
import type { ThemePreference } from '@/theme/palettes';

/** Everything the reader chooses in Settings (persisted as one record). */
export interface ReaderSettings {
  /** Reading font size in points, FONT_SIZE_MIN..FONT_SIZE_MAX. */
  fontSize: number;
  /** Line height as a multiple of the font size, LINE_HEIGHT_MIN..LINE_HEIGHT_MAX. */
  lineHeight: number;
  theme: ThemePreference;
  /** The face of the reading text: Source Serif 4 ("serif"), Literata or Inter ("sans"). */
  readingFont: ReadingFont;
  /** The edition in this language opens first (fallback order: ro, en, the source edition). */
  readingLanguage: ReadingLanguage;
  /** Language of the interface; "system" follows the device locale. */
  uiLanguage: UiLanguagePreference;
}

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 26;
export const LINE_HEIGHT_MIN = 1.3;
export const LINE_HEIGHT_MAX = 2.0;
export const LINE_HEIGHT_STEP = 0.1;

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'sepia', 'dark'];

/** The defaults of a device with this locale: the reading language is Romanian on a Romanian device. */
export function createDefaultSettings(deviceLocale: string | undefined): ReaderSettings {
  return {
    fontSize: 18,
    lineHeight: 1.6,
    theme: 'system',
    readingFont: 'serif',
    readingLanguage: languageFromLocale(deviceLocale),
    uiLanguage: 'system',
  };
}

export const DEFAULT_SETTINGS: ReaderSettings = createDefaultSettings(getDeviceLocale());
