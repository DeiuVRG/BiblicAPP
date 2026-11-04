import type { ThemePreference } from '@/theme/palettes';

export interface ReaderSettings {
  /** Reading font size in points, FONT_SIZE_MIN..FONT_SIZE_MAX. */
  fontSize: number;
  /** Line height as a multiple of the font size, LINE_HEIGHT_MIN..LINE_HEIGHT_MAX. */
  lineHeight: number;
  theme: ThemePreference;
}

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 26;
export const LINE_HEIGHT_MIN = 1.3;
export const LINE_HEIGHT_MAX = 2.0;
export const LINE_HEIGHT_STEP = 0.1;

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'sepia', 'dark'];

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.6,
  theme: 'system',
};
