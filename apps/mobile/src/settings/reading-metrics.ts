import { useWindowDimensions } from 'react-native';

import { DESKTOP_MIN } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';

import { useSettings } from './settings-context';
import {
  FONT_SIZE_PHONE,
  FONT_SIZE_WIDE,
  LINE_SPACING_NAMES,
  LINE_SPACING_PRESETS,
  NORMAL_DARK,
} from './types';
import type { LineSpacing, LineSpacingPreset, ReaderSettings } from './types';

// What the reader's text is set in, worked out from the settings, the window and the theme: the size
// the reader chose or the default of the window, and the multiple of the line spacing in the active
// theme (docs/ui-spec-v2.md, 2.3).

/** The size of the text when the reader has not chosen one: 17 on a phone, 20 from 1100 points. */
export function defaultFontSize(windowWidth: number): number {
  return windowWidth >= DESKTOP_MIN ? FONT_SIZE_WIDE : FONT_SIZE_PHONE;
}

/** The size of the reader's text: the one the reader chose, or the default of the window. */
export function effectiveFontSize(settings: Pick<ReaderSettings, 'fontSize'>, width: number): number {
  return settings.fontSize ?? defaultFontSize(width);
}

/** The line height as a multiple of the font size: a preset (`normal` is 1.68 in the dark theme) or the number. */
export function resolveLineHeight(spacing: LineSpacing, dark: boolean): number {
  if (typeof spacing === 'number') return spacing;
  return spacing === 'normal' && dark ? NORMAL_DARK : LINE_SPACING_PRESETS[spacing];
}

/**
 * The preset a spacing counts as in the `Aa` sheet: the preset itself, or the nearest one to a number
 * from the stepper of Settings (so that the group of three always has a chosen option).
 */
export function nearestPreset(spacing: LineSpacing, dark: boolean): LineSpacingPreset {
  if (typeof spacing !== 'number') return spacing;
  let best: LineSpacingPreset = 'normal';
  let distance = Infinity;
  for (const name of LINE_SPACING_NAMES) {
    const gap = Math.abs(resolveLineHeight(name, dark) - spacing);
    if (gap < distance - 1e-9) {
      best = name;
      distance = gap;
    }
  }
  return best;
}

export interface ReadingMetrics {
  /** Points. */
  fontSize: number;
  /** A multiple of the font size. */
  lineHeight: number;
}

/** The size and the line height the reader's text is set in right now. */
export function useReadingMetrics(): ReadingMetrics {
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  const { name } = useTheme();
  return {
    fontSize: effectiveFontSize(settings, width),
    lineHeight: resolveLineHeight(settings.lineSpacing, name === 'dark'),
  };
}
