import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useUiLanguage } from '@/i18n';
import { AppProviders } from '@/providers';
import { useSettings } from '@/settings/settings-context';
import { ShellRoot } from '@/shell/shell-root';
import { applyDocumentTheme } from '@/theme/document-theme';
import { useAppFonts } from '@/theme/fonts';
import { buildNavigationTheme } from '@/theme/navigation-theme';
import { useTheme } from '@/theme/theme-context';

// Keep the native splash until fonts and stored settings are ready (avoids a flash of the wrong
// theme or font). On web nothing is drawn until then: the HTML template already paints the page
// background, so there is no flash of the wrong theme or of fallback fonts.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStack({ fontsReady }: { fontsReady: boolean }) {
  const language = useUiLanguage();
  const { name, colors } = useTheme();
  const { ready: settingsReady } = useSettings();
  const ready = fontsReady && settingsReady;
  // Headers, back buttons and transitions read this instead of React Navigation's own themes.
  const navigationTheme = useMemo(
    () => buildNavigationTheme(name, colors, DefaultTheme.fonts),
    [name, colors],
  );

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // Web: the document (body background, scrollbars, browser chrome) follows the active palette.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      applyDocumentTheme(document, name, colors);
    }
  }, [name, colors]);

  // Web: the document language follows the interface language (screen readers, hyphenation).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  if (!ready) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={colors.statusBar} />
      <ShellRoot>
        {/* The shell is drawn by the screens themselves (the brand bar and the section bar are the
            first children of each screen's scroll container, docs/ui-spec-v2.md 4.2), so the
            navigator has no header of its own on any platform. */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </ShellRoot>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const { ready, families } = useAppFonts();
  return (
    <AppProviders families={families}>
      <ThemedStack fontsReady={ready} />
    </AppProviders>
  );
}
