import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';

import { AppText, useTypeStyle } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useFontFamilies } from '@/theme/fonts';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';

/** The diameter of a numbered circle: 1.7 rem. */
const CIRCLE = 27;

export interface StartEntry {
  key: string;
  /** Where the link goes (the reader at a paragraph). */
  href: ComponentProps<typeof Link>['href'];
  /** The link text: the title of the section the paragraph is in. */
  title: string;
  /** One sentence of why to start there. */
  why: string;
}

interface Props {
  entries: readonly StartEntry[];
  /** The accessible name of a link ("Deschide <titlu>"). */
  linkLabel(title: string): string;
  testID?: string;
}

/**
 * "Unde să începi" (docs/ui-spec-v2.md, 3 and 7): numbered circles, a terracotta underlined link into the
 * reader and one sentence of why. A list of three to five entries; nothing is drawn for none.
 */
export function StartList({ entries, linkLabel, testID = 'start-list' }: Props) {
  if (entries.length === 0) return null;
  return (
    <View testID={testID} accessibilityRole="list" style={styles.list}>
      {entries.map((entry, index) => (
        <View key={entry.key} accessibilityRole="listitem" style={styles.item}>
          <Numeral value={index + 1} />
          <View style={styles.text}>
            <Link href={entry.href} asChild>
              <StartLink
                testID={`start-${index + 1}`}
                title={entry.title}
                label={linkLabel(entry.title)}
              />
            </Link>
            <AppText variant="meta" muted>
              {entry.why}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function Numeral({ value }: { value: number }) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { borderColor: colors.borderStrong }]}
    >
      <AppText style={[styles.numeral, { fontFamily: fonts.textSemiBold, color: colors.text }]}>
        {value}
      </AppText>
    </View>
  );
}

type StartLinkProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  label: string;
  style?: ViewStyle;
};

// `Link asChild` merges its props and a plain style into this wrapper, as in `LinkRow`.
function StartLink({ title, label, style, ...rest }: StartLinkProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const text = useTypeStyle('body');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [styles.link, pressStyle(pressed, reduced), focusStyle, style]}
    >
      <AppText
        style={[
          text,
          styles.underline,
          { color: hovered ? colors.accentHover : colors.accentStrong },
        ]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  numeral: { fontSize: 14, lineHeight: 18, textAlign: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  // A link of running size: its hit area is the line, padded to the 44 point target.
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
});
