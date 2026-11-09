import { Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';

import { UI_MAX_FONT_SCALE, useTypeStyle } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { Icon } from '@/components/icon';
import { pressStyle } from '@/components/press';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  /** What `Link asChild` merges in (a plain object). */
  style?: ViewStyle;
};

/**
 * "⚑ Raportează o problemă cu această lucrare": a full-width outline button with the `flag` icon
 * (docs/ui-spec-v2.md, 8.6). It is a link (a prefilled mail) and takes the `Link asChild` slot. The
 * outline `Button` sweeps its fill on hover and turns its label white, which a drawn icon cannot
 * follow, so this one turns its border, label and icon `accentStrong` instead.
 */
export function ReportButton({ title, style, ...rest }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const label = useTypeStyle('button');
  const ink = hovered ? colors.accentStrong : colors.text;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { borderColor: hovered ? colors.accentStrong : colors.borderStrong },
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      <Icon name="flag" size={16} color={ink} />
      <Text maxFontSizeMultiplier={UI_MAX_FONT_SCALE} style={[label, styles.text, { color: ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: { flexShrink: 1, textAlign: 'center' },
});
