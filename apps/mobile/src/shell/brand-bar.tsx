import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { IconButton } from '@/components/icon-button';
import { useFeatures } from '@/config/features';
import { useT } from '@/i18n';
import { homeHref, searchHref, settingsHref } from '@/navigation-hrefs';
import { PHONE_MAX, columnStyle, useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { BAR_HEIGHT } from '@/theme/tokens';

import { BrandMark } from './brand-mark';
import { LanguageSwitch } from './language-switch';
import { useShell } from './shell-state';
import { getSlashTarget } from './slash-target';
import { ThemeButton } from './theme-button';

/** True for a key press in a field or an editor: the shortcut `/` must leave those alone. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = element?.tagName?.toLowerCase();
  return (
    tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable === true
  );
}

/**
 * The wordmark link. `Link asChild` merges its own props into this component's props, `style`
 * included, as plain objects: an array style on the child would become `{0: ..., 1: ...}`. The
 * style is therefore merged here, inside the pressable.
 */
function BrandLink({
  style,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: ViewStyle; children: ReactNode }) {
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...focusProps}
      {...rest}
      style={[styles.brand, focusStyle, style]}
    >
      {children}
    </Pressable>
  );
}

/**
 * The brand bar, the masthead of the product (docs/ui-spec-v2.md, 4.1): `cream`, 64 high (56 on a
 * phone), the mark and the wordmark on the left (a link to the landing), and on the right the search
 * button (shortcut `/`), the interface language, the theme, Settings and "Întreabă" on a wide screen,
 * "Întreabă" and the menu button on a phone. It scrolls away with the page: the section bar stays.
 * It is not shown inside the reader.
 */
export function BrandBar() {
  const t = useT();
  const { colors } = useTheme();
  const layout = useLayout();
  const features = useFeatures();
  const router = useRouter();
  const { setMenuOpen } = useShell();
  const phone = layout.width <= PHONE_MAX;

  // `/` opens the search from anywhere on web, except while typing; a screen with a search field of
  // its own takes the key for it (`slash-target.ts`). Only the screen in focus listens (the stack
  // keeps the screens that were left mounted).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        if (isTyping(event.target)) return;
        event.preventDefault();
        const target = getSlashTarget();
        if (target) target.focus();
        else router.push(searchHref);
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [router]),
  );

  const ask = features.ask ? (
    <Link href="/ask" asChild>
      <Button
        testID="ask-button"
        variant="primary"
        size="small"
        title={t.shell.askButton}
        label={t.shell.askButtonLabel}
        accessibilityRole="link"
      />
    </Link>
  ) : null;

  return (
    <View
      testID="brand-bar"
      role="banner"
      style={[styles.bar, { backgroundColor: colors.cream, borderBottomColor: colors.border }]}
    >
      <View
        style={[
          columnStyle('wide', layout),
          styles.row,
          { height: phone ? BAR_HEIGHT.brandPhone : BAR_HEIGHT.brand },
        ]}
      >
        <Link href={homeHref} asChild>
          <BrandLink testID="brand-link" accessibilityLabel={t.nav.homeLink}>
            <BrandMark />
            <AppText variant="displaySItalic" numberOfLines={1}>
              {t.appName}
            </AppText>
          </BrandLink>
        </Link>
        <View style={styles.right}>
          {phone ? (
            <>
              {ask}
              <IconButton
                testID="menu-button"
                name="menu"
                label={t.nav.menuOpen}
                onPress={() => setMenuOpen(true)}
              />
            </>
          ) : (
            <>
              <IconButton
                testID="brand-search"
                name="search"
                label={t.shell.searchButton}
                onPress={() => router.push(searchHref)}
              />
              <LanguageSwitch />
              <ThemeButton />
              <Link href={settingsHref} asChild>
                <Button
                  testID="settings-link"
                  variant="text"
                  size="small"
                  title={t.nav.settings}
                  accessibilityRole="link"
                />
              </Link>
              {ask}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%', borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    minHeight: 44,
    flexShrink: 1,
  },
  right: { flexDirection: 'row', alignItems: 'center', columnGap: 4, flexShrink: 0 },
});
