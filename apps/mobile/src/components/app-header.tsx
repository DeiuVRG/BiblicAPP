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
  // `headerTitle` is what the header shows; `title` also names the browser tab.
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
      style={[
        styles.bar,
        {
          height: layout.wide ? 64 : 56,
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
        <AppText variant="headerTitle" numberOfLines={1} testID="header-title" style={styles.title}>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  start: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  arrow: { paddingHorizontal: BUTTON_PAD },
  arrowText: { fontSize: 20, lineHeight: 24 },
  titleGap: { width: BUTTON_PAD },
  title: { flexShrink: 1, minWidth: 0 },
  end: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
});
