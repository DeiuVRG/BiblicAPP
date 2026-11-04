import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * Balanced line breaks for a title that wraps (web only), so that the last line is never a single
 * word. `textWrap` is a CSS property that react-native-web passes through; React Native's style
 * types do not know it, and iOS and Android ignore it.
 */
export const balancedLines: TextStyle | undefined =
  Platform.OS === 'web' ? ({ textWrap: 'balance' } as TextStyle) : undefined;
