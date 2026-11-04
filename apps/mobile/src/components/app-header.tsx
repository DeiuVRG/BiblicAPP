import { Link } from 'expo-router';
import type { NativeStackHeaderProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { t } from '@/i18n';
import { libraryHref } from '@/navigation-hrefs';
import { barInset, useLayout } from '@/theme/layout';
import type { ColumnKind } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';

/** Screens laid out on the narrow reading column: their header lines up with that column too. */
const READING_SCREENS: ReadonlySet<string> = new Set(['read/[id]/[section]', 'settings']);

/**
 * Screens whose header carries the name of the work, not the name of the page: it is set as a
 * quiet running head (muted italic, up to two lines on phones) so that it never competes with the
 * chapter heading below it or gets cut off mid-word.
 */
const RUNNING_TITLE_SCREENS: ReadonlySet<string> = new Set(['read/[id]/[section]']);

/** Space the text buttons add around their text; pulled back so the text meets the column edge. */
const BUTTON_PAD = 10;

/**
 * Navigation header for the web build: spans the full window, with its content lined up on the
 * same column as the screen below, a left-aligned serif title, a typographic back arrow and the
 * screen's header actions on the right. (iOS and Android keep their native headers.)
 */
export function AppHeader({ options, route, back, navigation }: NativeStackHeaderProps) {
  const { colors } = useTheme();
  const layout = useLayout();
  const column: ColumnKind = READING_SCREENS.has(route.name) ? 'reading' : 'list';
  const inset = barInset(column, layout);
  const running = RUNNING_TITLE_SCREENS.has(route.name);
  // `headerTitle` is what the header shows when it differs from the screen's `title`.
  const title =
    typeof options.headerTitle === 'string'
      ? options.headerTitle
      : typeof options.title === 'string'
        ? options.title
        : route.name;
  const actions = options.headerRight?.({ tintColor: colors.accent, canGoBack: Boolean(back) });

  return (
    <View
      accessibilityRole="banner"
      testID="app-header"
      style={[
        styles.bar,
        {
          minHeight: layout.wide ? 64 : 56,
          paddingHorizontal: inset - BUTTON_PAD,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.start}>
        {back ? (
          <Button
            variant="text"
            title="←"
            label={t.common.back}
            onPress={navigation.goBack}
            textStyle={styles.arrowText}
            style={styles.arrow}
          />
        ) : route.name !== 'index' ? (
          // Opened through a link (no history to go back to): offer the way to the library.
          <Link href={libraryHref} asChild>
            <Button
              variant="text"
              accessibilityRole="link"
              title="←"
              label={t.common.backToLibrary}
              textStyle={styles.arrowText}
              style={styles.arrow}
            />
          </Link>
        ) : (
          <View style={styles.titleGap} />
        )}
        <AppText
          variant={running ? 'original' : 'headerTitle'}
          accessibilityRole="header"
          level={1}
          numberOfLines={running && !layout.wide ? 2 : 1}
          testID="header-title"
          style={styles.title}
        >
          {title}
        </AppText>
      </View>
      {actions ? <View style={styles.end}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  start: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  arrow: { paddingHorizontal: BUTTON_PAD },
  arrowText: { fontSize: 20, lineHeight: 24 },
  titleGap: { width: BUTTON_PAD },
  // The right margin keeps the text inside the gutter, like the arrow and the links on the other side.
  title: { flexShrink: 1, minWidth: 0, marginRight: BUTTON_PAD },
  end: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
});
