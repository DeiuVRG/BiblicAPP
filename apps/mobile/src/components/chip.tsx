import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { isDarkBand, isPhotoBand, useBandTone } from '@/components/band-context';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

interface Props {
  label: string;
  /** `pill` (language and edition badges, radius 999) or `tag` (kind chips, radius 3). */
  shape?: 'pill' | 'tag';
  /** Bordered caps in `accentStrong`: a status such as "Neverificată". */
  status?: boolean;
  /** A chosen filter chip: filled with `text`, the label in `background`. */
  selected?: boolean;
  /** Makes the chip a button (a filter); without it the chip is a plain badge. */
  onPress?: () => void;
  /** Accessible name; defaults to the label. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A small bordered tag on the `chip` type style: 1 px `border`, no fill. A chip with `onPress` is
 * a toggle button whose touch target is 44 high (the drawn chip stays small inside it, centred).
 * A chip is an inline element: it belongs in a row and takes the row's `alignItems` (`center`
 * lines a static chip up with the pill of a pressable one); on its own in a column it would
 * stretch to the full width.
 */
export function Chip({
  label,
  shape = 'pill',
  status = false,
  selected = false,
  onPress,
  accessibilityLabel,
  testID,
}: Props) {
  const { colors } = useTheme();
  const band = useBandTone();
  const dark = isDarkBand(band);
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const interactive = onPress !== undefined;

  // Over a photograph the status is written in the ink, like the rest (the orange fails 4.5:1).
  const ink = dark ? colors.mastheadInk : colors.text;
  const accent = dark
    ? isPhotoBand(band)
      ? colors.mastheadInk
      : colors.mastheadAccent
    : colors.accentStrong;
  const borderColor = selected
    ? ink
    : status
      ? accent
      : dark
        ? colors.mastheadBorder
        : interactive && hovered
          ? colors.borderStrong
          : colors.border;
  const drawn = (extra?: { testID?: string; accessibilityLabel?: string }) => (
    <View
      {...extra}
      style={[
        styles.chip,
        {
          borderColor,
          borderRadius: shape === 'pill' ? radii.pill : radii.sm,
          backgroundColor: selected ? ink : undefined,
        },
      ]}
    >
      <AppText
        variant="chip"
        style={{
          color: selected ? (dark ? colors.masthead : colors.background) : status ? accent : ink,
        }}
      >
        {label}
      </AppText>
    </View>
  );

  if (!interactive) return drawn({ testID, accessibilityLabel });
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      // A toggle button: react-native-web reads the `aria-*` props only.
      aria-pressed={selected}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={({ pressed }) => [styles.target, pressStyle(pressed, reduced), focusStyle]}
    >
      {drawn()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: MIN_TARGET, justifyContent: 'center' },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
