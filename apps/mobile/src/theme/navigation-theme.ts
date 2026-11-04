import type { Theme } from 'expo-router';

import type { Palette, ThemeName } from './palettes';

/**
 * React Navigation theme derived from the palette, so that headers, back buttons and screen
 * transitions never fall back to the library's own light or dark theme. `fonts` come from the
 * caller (expo-router's DefaultTheme) to keep this module free of runtime imports.
 */
export function buildNavigationTheme(
  name: ThemeName,
  colors: Palette,
  fonts: Theme['fonts'],
): Theme {
  return {
    dark: name === 'dark',
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
    fonts,
  };
}
