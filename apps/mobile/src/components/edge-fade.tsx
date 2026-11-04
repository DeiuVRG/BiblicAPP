import { Platform, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

interface Props {
  side: 'left' | 'right';
  /** The colour of the surface the fade runs into (a six-digit palette colour); defaults to `background`. */
  color?: string;
  /** Width of the fade in points. */
  width?: number;
  testID?: string;
}

/** Number of flat strips that approximate the fade where there is no gradient (native). */
const STRIPS = [0.3, 0.55, 0.8, 0.95] as const;

/**
 * A fade at the edge of a scrolling strip that says "there is more this way" (the section bar and
 * the tab strips on a phone). The web draws a CSS gradient; native has no gradient module, so the
 * fade is a few flat strips of the surface colour with growing opacity (docs/ui-spec-v2.md, 19).
 * It never takes touches.
 */
export function EdgeFade({ side, color, width = 24, testID }: Props) {
  const { colors } = useTheme();
  const surface = color ?? colors.background;
  const base: ViewStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width,
  };
  if (Platform.OS === 'web') {
    const toward = side === 'right' ? 'to right' : 'to left';
    return (
      <View
        testID={testID}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={
          [
            base,
            { backgroundImage: `linear-gradient(${toward}, ${surface}00, ${surface})` },
          ] as ViewStyle[]
        }
      />
    );
  }
  const ordered = side === 'right' ? STRIPS : [...STRIPS].reverse();
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[base, styles.strips]}
    >
      {ordered.map((opacity) => (
        <View key={opacity} style={[styles.strip, { backgroundColor: surface, opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strips: { flexDirection: 'row' },
  strip: { flex: 1 },
});
