import { Link } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';

import { MIN_TARGET } from '@/components/button';
import { useHover } from '@/components/hover';
import { useTheme } from '@/theme/theme-context';

/** How far a row's hover background reaches past the text, into the gutter. */
const BLEED = 12;
const INDENT_STEP = 16;

interface Props {
  href: ComponentProps<typeof Link>['href'];
  accessibilityLabel: string;
  children: ReactNode;
  /** Nesting depth of a table-of-contents entry. */
  indent?: number;
  /** Marks the entry in progress with the accent rule on the left. */
  current?: boolean;
}

/**
 * A full-width tappable row rendered as a real link (anchor on web). Rows carry no border: the
 * list puts a `Hairline` between entries, so the rule stays as wide as the text while the hover
 * background reaches a little further.
 */
export function LinkRow({
  href,
  accessibilityLabel,
  children,
  indent = 0,
  current = false,
}: Props) {
  return (
    <Link href={href} asChild>
      <RowPressable accessibilityLabel={accessibilityLabel} indent={indent} current={current}>
        {children}
      </RowPressable>
    </Link>
  );
}

type RowPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  indent: number;
  current: boolean;
  /** Whatever style Link's slot merged in (a plain object). */
  style?: ViewStyle;
};

// Link's asChild slot adds props (href, onPress, role) to its child and merges `style` as plain
// objects, so the pressed and hover states live inside this wrapper rather than in a style callback
// handed to Link.
function RowPressable({ children, indent, current, style, ...rest }: RowPressableProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...rest}
      style={({ pressed }) => [
        styles.row,
        {
          paddingLeft: BLEED + indent * INDENT_STEP,
          backgroundColor: hovered ? colors.surface : undefined,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {current ? <View style={[styles.rule, { backgroundColor: colors.accent }]} /> : null}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TARGET,
    marginHorizontal: -BLEED,
    paddingVertical: 16,
    paddingRight: BLEED,
    borderRadius: 6,
    gap: 4,
  },
  rule: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
});
