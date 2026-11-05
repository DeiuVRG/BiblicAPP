import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { CLOSE_INSET, CloseButton } from '@/components/close-button';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useWebModalBehaviour } from '@/components/modal-behaviour';
import { ThemeControl } from '@/components/typography-controls';
import { useFeatures } from '@/config/features';
import { useT } from '@/i18n';
import { settingsHref } from '@/navigation-hrefs';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { easing, elevationStyle } from '@/theme/tokens';

import { LanguageSwitch } from './language-switch';
import { useShell } from './shell-state';

/** The right-hand drawer of the phone menu: 304 wide, 260 ms slide (docs/ui-spec-v2.md, 4.1). */
export const MENU_DRAWER_WIDTH = 304;
export const MENU_DRAWER_MS = 260;

/** The pressable of a menu row: `Link asChild` merges `style` as a plain object, so it is merged here. */
function MenuRow({
  style,
  children,
  onNavigate,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: ViewStyle;
  children: ReactNode;
  /** Called after the link was followed (the menu closes). */
  onNavigate?(): void;
}) {
  const { colors } = useTheme();
  const { focusProps, focusStyle } = useFocusRing();
  // The handler that follows the link comes from `Link` (it must not be replaced: `Link` would stop
  // navigating on web); this one runs it, then the side effect.
  const { onPress: follow, ...others } = rest;
  return (
    <Pressable
      accessibilityRole="link"
      {...focusProps}
      {...others}
      onPress={(event) => {
        follow?.(event);
        onNavigate?.();
      }}
      style={[styles.link, { borderTopColor: colors.border }, focusStyle, style]}
    >
      {children}
    </Pressable>
  );
}

function MenuLink({
  href,
  label,
  testID,
  onPress,
}: {
  href: React.ComponentProps<typeof Link>['href'];
  label: string;
  testID: string;
  onPress(): void;
}) {
  return (
    <Link href={href} asChild>
      <MenuRow testID={testID} accessibilityLabel={label} onNavigate={onPress}>
        <AppText variant="railDrawer">{label}</AppText>
      </MenuRow>
    </Link>
  );
}

/**
 * The phone menu: a drawer from the right (304 points wide, 260 ms, close ×) with the interface
 * language, the theme, the About links and Settings. One instance serves the whole app (it is mounted
 * once, by `ShellRoot`); the brand bar's menu button opens it. The page behind is inert while it is
 * open, Escape and the scrim close it, and a route change does too.
 */
export function MenuDrawer() {
  const t = useT();
  const { colors } = useTheme();
  const features = useFeatures();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduced = useReducedMotion();
  const { menuOpen, setMenuOpen } = useShell();
  const visible = menuOpen;
  useWebModalBehaviour(visible);
  const close = () => setMenuOpen(false);

  // The drawer stays mounted until it has slid away (`leaving`, set while rendering, as `Sheet` does).
  const [leaving, setLeaving] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    setLeaving(!visible && !reduced);
  }
  const mounted = visible || leaving;
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(visible ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: MENU_DRAWER_MS,
      easing: Easing.bezier(...easing.panel),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setLeaving(false);
    });
    return () => animation.stop();
  }, [visible, reduced, progress]);

  const width = Math.min(MENU_DRAWER_WIDTH, window.width);
  const slide = progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
      {...({ accessibilityLabel: t.nav.menu } as object)}
    >
      <View style={styles.root} testID="menu-drawer">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          {/* A plain view with a responder, not a Pressable: it must not take the keyboard focus. */}
          <View
            testID="menu-drawer-scrim"
            accessible={false}
            importantForAccessibility="no"
            onStartShouldSetResponder={() => true}
            onResponderRelease={close}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDrawer }]}
          />
        </Animated.View>
        <Animated.View
          testID="menu-drawer-panel"
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              width,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              backgroundColor: colors.background,
              borderLeftColor: colors.border,
              transform: [{ translateX: slide }],
            },
            elevationStyle('dialog', colors),
          ]}
        >
          <View style={styles.header}>
            <AppText variant="displaySItalic" level={2} style={styles.title}>
              {t.nav.menu}
            </AppText>
            <CloseButton testID="menu-drawer-close" label={t.nav.menuClose} onPress={close} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.block}>
              <AppText variant="label">{t.shell.menuLanguage}</AppText>
              <View style={styles.switch}>
                <LanguageSwitch testID="menu-language-switch" tall />
              </View>
            </View>
            <View style={styles.block}>
              <AppText variant="label">{t.shell.menuTheme}</AppText>
              <ThemeControl labelled={false} />
            </View>
            <View style={styles.links}>
              {features.about ? (
                <MenuLink
                  href="/about"
                  label={t.nav.aboutLibrary}
                  testID="menu-link-about"
                  onPress={close}
                />
              ) : null}
              {features.transparency ? (
                <MenuLink
                  href="/about/transparency"
                  label={t.nav.transparency}
                  testID="menu-link-transparency"
                  onPress={close}
                />
              ) : null}
              <MenuLink
                href={settingsHref}
                label={t.nav.settings}
                testID="menu-link-settings"
                onPress={close}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  panel: { position: 'absolute', top: 0, bottom: 0, right: 0, borderLeftWidth: 1 },
  // The close button is in the corner: inset, so that its focus ring is not cut.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingTop: CLOSE_INSET,
    paddingRight: CLOSE_INSET,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 24 },
  block: { gap: 8 },
  switch: { alignSelf: 'flex-start' },
  links: { marginTop: 8 },
  link: { minHeight: MIN_TARGET + 4, justifyContent: 'center', borderTopWidth: 1 },
});
