import type { ThemePreference } from '@/theme/palettes';

import { DEFAULT_SETTINGS, FONT_SIZE_MAX, FONT_SIZE_MIN, LINE_HEIGHT_MAX, LINE_HEIGHT_MIN, THEME_PREFERENCES } from './types';
import type { ReaderSettings } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundLineHeight(value: number): number {
  return Math.round(clamp(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX) * 10) / 10;
}

/** Turns untrusted stored data into valid settings; invalid fields fall back to defaults. */
export function sanitizeSettings(raw: unknown): ReaderSettings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const fontSize =
    typeof source.fontSize === 'number' && Number.isFinite(source.fontSize)
      ? Math.round(clamp(source.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
      : DEFAULT_SETTINGS.fontSize;
  const lineHeight =
    typeof source.lineHeight === 'number' && Number.isFinite(source.lineHeight)
      ? roundLineHeight(source.lineHeight)
      : DEFAULT_SETTINGS.lineHeight;
  const theme = THEME_PREFERENCES.includes(source.theme as ThemePreference)
    ? (source.theme as ThemePreference)
    : DEFAULT_SETTINGS.theme;
  return { fontSize, lineHeight, theme };
}
