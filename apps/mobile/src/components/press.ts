import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

import { duration, motion, transition } from '@/theme/tokens';

/**
 * The pressed look of a control (docs/ui-spec-v2.md, 2.6 and 3): `scale(.96)` on web and opacity
 * 0.7 on native. On web a short transition eases the change, unless motion is reduced. Spread it
 * into the style of a `Pressable` after the control's own layout style.
 */
export function pressStyle(pressed: boolean, reduced: boolean): ViewStyle[] {
  if (Platform.OS === 'web') {
    const eased = transition('transform', duration.press, 'default', reduced);
    return [
      pressed ? { transform: [{ scale: motion.pressScale }] } : {},
      ...(eased ? [eased] : []),
    ];
  }
  return [{ opacity: pressed ? motion.pressOpacity : 1 }];
}
