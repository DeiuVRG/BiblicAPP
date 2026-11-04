import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { isDarkBand, useBandTone } from '@/components/band-context';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
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
 * a toggle button whose touch target is 44 high (the drawn chip stays small inside it).
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
  const dark = isDarkBand(useBandTone());
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const interactive = onPress !== undefined;

  const accent = dark ? colors.mastheadAccent : colors.accentStrong;
  const ink = dark ? colors.mastheadInk : colors.text;
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
      style={({ pressed }) => [styles.target, { opacity: pressed ? 0.7 : 1 }, focusStyle]}
    >
      {drawn()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { alignSelf: 'flex-start', minHeight: MIN_TARGET, justifyContent: 'center' },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
