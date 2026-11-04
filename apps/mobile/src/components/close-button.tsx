import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { useTheme } from '@/theme/theme-context';

interface Props {
  /** The accessible name, in the interface language ("Închide"). */
  label: string;
  onPress(): void;
  testID?: string;
}

/** The close "×" of a dialog or a sheet: a typographic glyph in a 44 x 44 target. */
export function CloseButton({ label, onPress, testID }: Props) {
  const { colors } = useTheme();
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
      style={({ pressed }) => [styles.target, { opacity: pressed ? 0.7 : 1 }, focusStyle]}
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
