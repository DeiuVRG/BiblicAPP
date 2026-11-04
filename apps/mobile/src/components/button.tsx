import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: 'primary' | 'secondary';
  /** Accessible name; defaults to `title`. */
  label?: string;
}

/** Minimum touch target (44pt) following platform guidance. */
export const MIN_TARGET = 44;

export function Button({ title, variant = 'secondary', label, disabled, ...rest }: Props) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: primary ? colors.accent : colors.surface,
          borderColor: primary ? colors.accent : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppText variant="label" style={{ color: primary ? colors.onAccent : colors.text }}>
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
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
