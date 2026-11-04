import { Link } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { MIN_TARGET } from '@/components/button';
import { useTheme } from '@/theme/theme-context';

interface Props {
  href: ComponentProps<typeof Link>['href'];
  accessibilityLabel: string;
  children: ReactNode;
  indent?: number;
}

/** A full-width tappable row rendered as a real link (anchor on web). */
export function LinkRow({ href, accessibilityLabel, children, indent = 0 }: Props) {
  const { colors } = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        // A flat style object: Link's asChild slot spreads `style`, which breaks arrays/functions on web.
        style={StyleSheet.flatten([
          styles.row,
          { borderBottomColor: colors.border, paddingLeft: 16 + indent * 16 },
        ])}
      >
        {children}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TARGET,
    paddingVertical: 12,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
