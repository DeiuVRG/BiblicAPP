import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps, StyleProp, TextStyle, ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { useHover } from '@/components/hover';
import { useTheme } from '@/theme/theme-context';

/** Minimum touch target (44pt) following platform guidance. */
export const MIN_TARGET = 44;
const PRIMARY_HEIGHT = 48;
const RADIUS = 6;

export type ButtonVariant = 'primary' | 'secondary' | 'text';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  /** Primary: accent fill. Secondary: 1 px outline. Text: accent text, underlined on hover. */
  variant?: ButtonVariant;
  /** Accessible name; defaults to `title`. */
  label?: string;
  /** Layout of the button itself (must be a plain style: `Link asChild` merges it). */
  style?: ViewStyle;
  /** Overrides for the title text, for example a different font. */
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  variant = 'secondary',
  label,
  disabled,
  style,
  textStyle,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const primary = variant === 'primary';
  const text = variant === 'text';
  const hover = hovered && !disabled;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...hoverProps}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : null,
        {
          backgroundColor: primary ? colors.accent : hover && !text ? colors.surface : undefined,
          borderColor: primary
            ? colors.accent
            : text
              ? undefined
              : hover
                ? colors.textMuted
                : colors.border,
          borderWidth: text ? 0 : 1,
          opacity: disabled ? 0.45 : pressed ? 0.7 : primary && hover ? 0.9 : 1,
        },
        style,
      ]}
    >
      <AppText
        variant="ui"
        style={[
          { color: primary ? colors.onAccent : text ? colors.accent : colors.text },
          text && hover ? styles.underline : null,
          styles.title,
          textStyle,
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { minHeight: PRIMARY_HEIGHT },
  title: { textAlign: 'center' },
  underline: { textDecorationLine: 'underline' },
});
