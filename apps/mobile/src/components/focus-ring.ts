import { useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

import { isDarkBand, useBandTone } from '@/components/band-context';
import { useTheme } from '@/theme/theme-context';
import { FOCUS_RING } from '@/theme/tokens';

/**
 * The colour of the focus ring where the component sits: `accentStrong` on the page bands,
 * `mastheadInk` on the dark ones and over photographs (docs/ui-spec-v2.md, section 2.1, rule 5).
 */
export function useRingColor(): string {
  const { colors } = useTheme();
  return isDarkBand(useBandTone()) ? colors.mastheadInk : colors.accentStrong;
}

/**
 * Focus feedback for a control. On web the page's own `:focus-visible` rule draws the ring (2 px,
 * offset 2, for keyboard focus only; a band on `masthead` re-colours it, see public/index.html), so
 * this returns nothing there. On native it returns the focus handlers and, while the control has
 * focus (a hardware keyboard), the same ring as an outline, which takes no room in the layout.
 */
export function useFocusRing(): {
  focusProps: { onFocus?: () => void; onBlur?: () => void };
  focusStyle: ViewStyle | undefined;
} {
  const ring = useRingColor();
  const [focused, setFocused] = useState(false);
  const focusProps = useMemo(
    () =>
      Platform.OS === 'web'
        ? {}
        : { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    [],
  );
  const focusStyle: ViewStyle | undefined =
    focused && Platform.OS !== 'web'
      ? {
          outlineStyle: 'solid',
          outlineWidth: FOCUS_RING.width,
          outlineOffset: FOCUS_RING.offset,
          outlineColor: ring,
        }
      : undefined;
  return { focusProps, focusStyle };
}
