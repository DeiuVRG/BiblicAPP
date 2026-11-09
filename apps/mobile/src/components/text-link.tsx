import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import type { TextVariant } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useCoarsePointer } from '@/theme/pointer';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  /** The type of the link: `meta` by default (an author's name above a title), `body` for a line of its own. */
  variant?: TextVariant;
  /** The 44 point target: a link on a line of its own is as high as a button on a phone and with a finger. */
  tall?: boolean;
  /** What `Link asChild` merges in (a plain object). */
  style?: ViewStyle;
};

/**
 * A link in running type (the author's name on the work page): normal case in `accentStrong`, underlined,
 * `accentHover` on hover. Unlike the `text` button it is not a capital-letter call to action. It takes
 * the `Link asChild` slot.
 */
export function TextLink({ title, variant = 'meta', tall = false, style, ...rest }: Props) {
  const { colors } = useTheme();
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.link,
        tall || coarse ? { minHeight: MIN_TARGET } : null,
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      <AppText
        variant={variant}
        style={[styles.underline, { color: hovered ? colors.accentHover : colors.accentStrong }]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
