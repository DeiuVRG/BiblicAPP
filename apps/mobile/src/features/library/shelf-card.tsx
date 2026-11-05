import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useT } from '@/i18n';
import type { ReadingLanguage } from '@/i18n/language';
import type { LibraryShelf } from '@/library/model';
import { shelfLabel } from '@/library/model';
import { libraryAllWith } from '@/navigation-hrefs';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

interface Props {
  shelf: LibraryShelf;
  language: ReadingLanguage;
}

/** The height of the typographic plate (the plates of the reference are 110 high). */
const PLATE_HEIGHT = 110;

/**
 * A shelf of the library (docs/ui-spec-v2.md, 3 and 6.3): a typographic plate (the name of the shelf
 * in `displayS` on `warm`, a hairline border), the name, "N lucrări" and a who-line of up to five
 * surnames in italic, two lines at most. The whole card links to the shelf page. A shelf that holds
 * no work has no card: the model does not list it.
 */
export function ShelfCard({ shelf, language }: Props) {
  const t = useT();
  const name = shelfLabel(shelf, language);
  const who = shelf.who.join(', ');
  return (
    <Link href={libraryAllWith({ shelf: shelf.slug })} asChild>
      <ShelfPressable
        testID={`shelf-card-${shelf.slug}`}
        accessibilityLabel={`${name}. ${t.library.shelfWorks(shelf.workIds.length)}${who ? `. ${who}` : ''}`}
      >
        {(hovered) => (
          <ShelfBody
            name={name}
            count={t.library.shelfWorks(shelf.workIds.length)}
            who={who}
            hovered={hovered}
          />
        )}
      </ShelfPressable>
    </Link>
  );
}

function ShelfBody({
  name,
  count,
  who,
  hovered,
}: {
  name: string;
  count: string;
  who: string;
  hovered: boolean;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View
        style={[
          styles.plate,
          { backgroundColor: colors.warm, borderColor: hovered ? colors.accent : colors.border },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <AppText variant="displayS" style={styles.plateText}>
          {name}
        </AppText>
      </View>
      <AppText variant="heading" level={3} style={hovered ? { color: colors.accentStrong } : null}>
        {name}
      </AppText>
      <AppText variant="meta">{count}</AppText>
      {who ? (
        <AppText variant="original" numberOfLines={2} style={styles.who}>
          {who}
        </AppText>
      ) : null}
    </>
  );
}

type ShelfPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children: (hovered: boolean) => React.ReactNode;
  style?: ViewStyle;
};

function ShelfPressable({ children, style, ...rest }: ShelfPressableProps) {
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [styles.card, pressStyle(pressed, reduced), focusStyle, style]}
    >
      {children(hovered)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, alignItems: 'stretch' },
  plate: {
    height: PLATE_HEIGHT,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  plateText: { textAlign: 'center' },
  who: { fontSize: 12, lineHeight: 17 },
});
