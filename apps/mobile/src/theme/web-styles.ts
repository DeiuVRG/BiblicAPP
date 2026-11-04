import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * Balanced line breaks for a title that wraps (web only), so that the last line is never a single
 * word. `textWrap` is a CSS property that react-native-web passes through; React Native's style
 * types do not know it, and iOS and Android ignore it.
 */
export const balancedLines: TextStyle | undefined =
  Platform.OS === 'web' ? ({ textWrap: 'balance' } as TextStyle) : undefined;

/**
 * Props that tell assistive technology the language of a piece of text, for text that is not in
 * the language of the interface (a work read in English under a Romanian interface): the `lang`
 * attribute on web, `accessibilityLanguage` for VoiceOver. Android has no such prop. Neither is
 * part of React Native's `TextProps` types, hence the loose return type to spread into a `Text`.
 */
export function textLanguageProps(language: string | undefined): object | undefined {
  if (!language) return undefined;
  if (Platform.OS === 'web') return { lang: language };
  if (Platform.OS === 'ios') return { accessibilityLanguage: language };
  return undefined;
}
