import { getDeviceLocale } from '@/i18n/device-locale';
import { languageFromLocale } from '@/i18n/language';
import type { ReadingLanguage, UiLanguagePreference } from '@/i18n/language';
import type { ReadingFont } from '@/theme/font-families';
import type { ThemePreference } from '@/theme/palettes';

/**
 * The spacing between the lines of the reader's text (docs/ui-spec-v2.md, 2.3 and 8.7): one of the
 * three presets of the `Aa` sheet, or a number (the 1.3 to 2.0 stepper of Settings). The preset
 * `normal` is a little looser in the dark theme (1.68); that comes from the theme, it is not stored.
 */
export type LineSpacingPreset = 'compact' | 'normal' | 'relaxed';
export type LineSpacing = LineSpacingPreset | number;

/** Everything the reader chooses in Settings (persisted as one record). */
export interface ReaderSettings {
  /**
   * Reading font size in points, FONT_SIZE_MIN..FONT_SIZE_MAX, or null while the reader has not
   * chosen one: then it is the default of the window (17 on a phone, 20 from 1100 points wide), so a
   * new install gets the size that suits its screen and a reader who chose one keeps it.
   */
  fontSize: number | null;
  lineSpacing: LineSpacing;
  theme: ThemePreference;
  /** The face of the reading text: Source Serif 4 ("serif"), Literata or Inter ("sans"). */
  readingFont: ReadingFont;
  /** The edition in this language opens first (fallback order: ro, en, the source edition). */
  readingLanguage: ReadingLanguage;
  /** Language of the interface; "system" follows the device locale. */
  uiLanguage: UiLanguagePreference;
  /**
   * The pair of editions read side by side by default ("ro+en": two language codes, or "orig" for the
   * source edition when its language is neither); null while the reader has not chosen one (then it
   * is the reading language first). Remembered per work as well (`reading/pair-store.ts`).
   */
  readerPair: string | null;
}

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 34;
/** The default size of the text: 17 on a phone and 20 from `DESKTOP_MIN` points wide (deviation D-15). */
export const FONT_SIZE_PHONE = 17;
export const FONT_SIZE_WIDE = 20;
export const LINE_HEIGHT_MIN = 1.3;
export const LINE_HEIGHT_MAX = 2.0;
export const LINE_HEIGHT_STEP = 0.1;

/** The multiples of the three presets; `normal` is `NORMAL_DARK` in the dark theme. */
export const LINE_SPACING_PRESETS: Readonly<Record<LineSpacingPreset, number>> = {
  compact: 1.45,
  normal: 1.55,
  relaxed: 1.85,
};
export const NORMAL_DARK = 1.68;
export const LINE_SPACING_NAMES: readonly LineSpacingPreset[] = ['compact', 'normal', 'relaxed'];

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'sepia', 'dark'];

/** The defaults of a device with this locale: the reading language is Romanian on a Romanian device. */
export function createDefaultSettings(deviceLocale: string | undefined): ReaderSettings {
  return {
    fontSize: null,
    lineSpacing: 'normal',
    theme: 'system',
    readingFont: 'serif',
    readingLanguage: languageFromLocale(deviceLocale),
    uiLanguage: 'system',
    readerPair: null,
  };
}

export const DEFAULT_SETTINGS: ReaderSettings = createDefaultSettings(getDeviceLocale());
