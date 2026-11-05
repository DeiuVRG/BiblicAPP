import { Pressable, StyleSheet } from 'react-native';

import { toneColor } from '@/components/app-text';
import { isDarkBand, useBandTone } from '@/components/band-context';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { Icon } from '@/components/icon';
import type { IconName } from '@/components/icon';
import { pressStyle } from '@/components/press';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';

interface Props {
  name: IconName;
  /** The accessible name in the interface language: required, an icon alone says nothing. */
  label: string;
  onPress?(): void;
  /** Shown as the pressed or chosen state (`accessibilityState.selected`). */
  selected?: boolean;
  /** For a button that opens and closes something: whether it is open. */
  expanded?: boolean;
  disabled?: boolean;
  size?: number;
  testID?: string;
}

/** An icon in a 44 x 44 target with an accessible name; the icon turns `accentStrong` on hover. */
export function IconButton({
  name,
  label,
  onPress,
  selected,
  expanded,
  disabled,
  size = 20,
  testID,
}: Props) {
  const { colors } = useTheme();
  const band = useBandTone();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const active = (hovered || selected === true) && !disabled;
  const color = active
    ? toneColor(colors, 'accent', band)
    : toneColor(colors, isDarkBand(band) ? 'text' : 'muted', band);
  return (
    <Pressable
      testID={testID ?? `icon-button-${name}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: !!disabled,
        ...(selected === undefined ? null : { selected }),
        ...(expanded === undefined ? null : { expanded }),
      }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-expanded={expanded}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={({ pressed }) => [
        styles.target,
        disabled ? { opacity: 0.6 } : pressStyle(pressed, reduced),
        focusStyle,
      ]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
});
