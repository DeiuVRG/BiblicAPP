import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';

/**
 * Room to leave around a close button in the corner of a clipped panel: the focus ring (4) plus
 * 4 more, so that the ring stays inside the rounded corner (radius 12) instead of being cut by it.
 * Dialog and Sheet pad the top and the right of their header with it.
 */
export const CLOSE_INSET = 8;

interface Props {
  /** The accessible name, in the interface language ("Închide"). */
  label: string;
  onPress(): void;
  testID?: string;
}

/** The close "×" of a dialog or a sheet: a typographic glyph in a 44 x 44 target. */
export function CloseButton({ label, onPress, testID }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={({ pressed }) => [styles.target, pressStyle(pressed, reduced), focusStyle]}
    >
      <AppText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.glyph, { color: hovered ? colors.accentStrong : colors.textMuted }]}
      >
        ×
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 28, lineHeight: 30, textAlign: 'center' },
});
